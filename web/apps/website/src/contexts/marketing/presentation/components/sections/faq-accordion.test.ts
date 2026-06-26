import { describe, expect, it } from 'vitest';

/**
 * Tests for FAQ accordion rendering logic.
 * Since the component is a thin wrapper around shadcn Accordion,
 * we test the data transformation and key generation logic.
 */

interface FAQItem {
  question: string;
  answer: string;
}

function generateFAQKeys(items: FAQItem[]) {
  return items.map((item, i) => ({
    key: item.question,
    value: `faq-${i}`,
    question: item.question,
    answer: item.answer,
  }));
}

const SAMPLE_FAQS: FAQItem[] = [
  { question: 'What is CauseFlow AI?', answer: 'An AI-powered incident investigation platform.' },
  { question: 'How does pricing work?', answer: 'We offer tiered plans based on incident volume.' },
  { question: 'Is my data secure?', answer: 'Yes, we use end-to-end encryption.' },
];

describe('FAQ Accordion data handling', () => {
  it('generates unique keys from question text', () => {
    const keys = generateFAQKeys(SAMPLE_FAQS);
    const uniqueKeys = new Set(keys.map((k) => k.key));
    expect(uniqueKeys.size).toBe(SAMPLE_FAQS.length);
  });

  it('generates sequential accordion values', () => {
    const keys = generateFAQKeys(SAMPLE_FAQS);
    expect(keys[0].value).toBe('faq-0');
    expect(keys[1].value).toBe('faq-1');
    expect(keys[2].value).toBe('faq-2');
  });

  it('preserves all question and answer data', () => {
    const keys = generateFAQKeys(SAMPLE_FAQS);
    for (let i = 0; i < SAMPLE_FAQS.length; i++) {
      expect(keys[i].question).toBe(SAMPLE_FAQS[i].question);
      expect(keys[i].answer).toBe(SAMPLE_FAQS[i].answer);
    }
  });

  it('handles empty items array', () => {
    const keys = generateFAQKeys([]);
    expect(keys).toEqual([]);
  });

  it('handles single item', () => {
    const keys = generateFAQKeys([{ question: 'Solo question?', answer: 'Solo answer.' }]);
    expect(keys).toHaveLength(1);
    expect(keys[0].key).toBe('Solo question?');
    expect(keys[0].value).toBe('faq-0');
  });
});
