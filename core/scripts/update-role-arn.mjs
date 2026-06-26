import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const REGION = 'us-east-2';
const TABLE = 'causeflow-staging';
const KMS_KEY = 'fd58115d-05ac-43d3-8d44-8b0c39b64493';
const PK = '$causeflow#tenantid_org_3cie2py6g6xwnuu9ta0oopguw9u';
const SK = '$integration_1#integrationid_aws-credential';
const NEW_ROLE_ARN = 'arn:aws:iam::857876979211:role/CauseFlowSimUserStagingRole';

const ddb = new DynamoDBClient({ region: REGION });
const kms = new KMSClient({ region: REGION });

async function decrypt({ ciphertext, encryptedDek, iv, tag }) {
  const { Plaintext } = await kms.send(new DecryptCommand({ CiphertextBlob: Buffer.from(encryptedDek, 'base64') }));
  const dec = createDecipheriv('aes-256-gcm', Buffer.from(Plaintext), Buffer.from(iv, 'base64'), { authTagLength: 16 });
  dec.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([dec.update(Buffer.from(ciphertext, 'base64')), dec.final()]).toString('utf8');
}

async function encrypt(plaintext) {
  const { Plaintext: dek, CiphertextBlob: dekEnc } = await kms.send(new GenerateDataKeyCommand({ KeyId: KMS_KEY, KeySpec: 'AES_256' }));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(dek), iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: encrypted.toString('base64'),
    encryptedDek: Buffer.from(dekEnc).toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

const { Item } = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: PK }, sk: { S: SK } } }));
if (!Item) { console.log(JSON.stringify({ ok: false, reason: 'item not found' })); process.exit(1); }

const current = await decrypt({
  ciphertext: Item.encryptedCredentials.S,
  encryptedDek: Item.credentialDek.S,
  iv: Item.credentialIv.S,
  tag: Item.credentialTag.S,
});
const parsed = JSON.parse(current);
console.log(JSON.stringify({ step: 'current', keys: Object.keys(parsed), oldRoleArn: parsed.roleArn, region: parsed.region }));

parsed.roleArn = NEW_ROLE_ARN;
const reEnc = await encrypt(JSON.stringify(parsed));

await ddb.send(new UpdateItemCommand({
  TableName: TABLE,
  Key: { pk: { S: PK }, sk: { S: SK } },
  UpdateExpression: 'SET encryptedCredentials = :c, credentialDek = :d, credentialIv = :i, credentialTag = :t, updatedAt = :u',
  ExpressionAttributeValues: {
    ':c': { S: reEnc.ciphertext },
    ':d': { S: reEnc.encryptedDek },
    ':i': { S: reEnc.iv },
    ':t': { S: reEnc.tag },
    ':u': { S: new Date().toISOString() },
  },
}));

console.log(JSON.stringify({ ok: true, newRoleArn: NEW_ROLE_ARN }));
