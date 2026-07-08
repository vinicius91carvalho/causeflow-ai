'use client';

import { PLANS } from '@causeflow/shared/constants';
import { cn } from '@causeflow/ui/lib';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from '@causeflow/ui/primitives';
import { useState } from 'react';

const TIME_OPTIONS = [
  { value: '0.5', label: '30 minutes' },
  { value: '1', label: '1 hour' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
];

const SORTED_PLANS = Object.values(PLANS)
  .filter((p) => p.credits > 0)
  .sort((a, b) => a.credits - b.credits);

function getCauseFlowPlan(incidents: number) {
  const match = SORTED_PLANS.find((p) => incidents <= p.credits);
  return match
    ? { name: match.name, cost: match.price }
    : { name: PLANS.enterprise.name, cost: PLANS.business.price };
}

interface ROICalculatorProps {
  className?: string;
  initialIncidents?: number;
  labels?: {
    title?: string;
    incidents?: string;
    time?: string;
    engineers?: string;
    hoursSaved?: string;
    causeflowCost?: string;
    perSeatCost?: string;
    platformCost?: string;
    annualSavings?: string;
  };
}

export function ROICalculator({ className, initialIncidents, labels }: ROICalculatorProps) {
  const [incidents, setIncidents] = useState(Math.min(initialIncidents ?? 50, 500));
  const [avgTime, setAvgTime] = useState('2');
  const [engineers, setEngineers] = useState(10);

  const timeHours = parseFloat(avgTime);
  const hoursSaved = Math.round(incidents * timeHours * 0.95);
  const plan = getCauseFlowPlan(incidents);
  const perSeatCost = engineers * 45;
  const platformCost = engineers * 20;
  const bestCompetitor = Math.min(perSeatCost, platformCost);
  const annualSavings = Math.max(0, (bestCompetitor - plan.cost) * 12);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>{labels?.title || 'ROI Calculator'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-6">
            <div>
              <Label>
                {labels?.incidents || 'Incidents per month'}: <strong>{incidents}</strong>
              </Label>
              <Slider
                aria-label={labels?.incidents || 'Incidents per month'}
                className="mt-2"
                min={1}
                max={500}
                step={1}
                value={[incidents]}
                onValueChange={([v]) => setIncidents(v!)}
              />
            </div>
            <div>
              <Label>{labels?.time || 'Average investigation time'}</Label>
              <Select value={avgTime} onValueChange={setAvgTime}>
                <SelectTrigger
                  className="mt-2"
                  aria-label={labels?.time || 'Average investigation time'}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {labels?.engineers || 'Engineers on team'}: <strong>{engineers}</strong>
              </Label>
              <Slider
                aria-label={labels?.engineers || 'Engineers on team'}
                className="mt-2"
                min={1}
                max={100}
                step={1}
                value={[engineers]}
                onValueChange={([v]) => setEngineers(v!)}
              />
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4 rounded-lg bg-muted p-6">
            <div>
              <p className="text-sm text-muted-foreground">
                {labels?.hoursSaved || 'Hours saved per month'}
              </p>
              <p className="text-3xl font-bold text-primary">{hoursSaved}h</p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {labels?.causeflowCost || 'CauseFlow cost'} ({plan.name})
              </p>
              <p className="text-2xl font-bold">${Math.round(plan.cost)}/mo</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {labels?.perSeatCost || 'Per-seat tools cost'}
              </p>
              <p className="text-lg text-muted-foreground line-through">${perSeatCost}/mo</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {labels?.platformCost || 'Enterprise platform cost'}
              </p>
              <p className="text-lg text-muted-foreground line-through">${platformCost}/mo</p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {labels?.annualSavings || 'Estimated annual savings'}
              </p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                ${annualSavings.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
