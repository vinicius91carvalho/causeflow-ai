export interface IUserEmailResolver {
  /** Resolve primary email for a batch of user ids. Returns a map. Missing/unknown ids map to ''. */
  resolveEmails(userIds: string[]): Promise<Map<string, string>>;
}
