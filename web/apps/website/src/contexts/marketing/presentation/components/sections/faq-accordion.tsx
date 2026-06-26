'use client';
import { cn } from '@causeflow/ui/lib';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@causeflow/ui/primitives';

interface FAQAccordionProps {
  items: Array<{ question: string; answer: string }>;
  className?: string;
}

export function FAQAccordion({ items, className }: FAQAccordionProps) {
  return (
    <Accordion type="single" collapsible className={cn('w-full', className)}>
      {items.map((item, i) => (
        <AccordionItem key={item.question} value={`faq-${i}`}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
