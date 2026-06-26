import { cn } from '@causeflow/ui/lib';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@causeflow/ui/primitives';

interface ComparisonTableProps {
  headers: string[];
  rows: Array<{ dimension: string; values: string[] }>;
  highlightColumn?: number;
  className?: string;
}

export function ComparisonTable({
  headers,
  rows,
  highlightColumn = 0,
  className,
}: ComparisonTableProps) {
  const renderValue = (val: string) => {
    if (val === '✓') return <span className="text-emerald-500 font-bold">✓</span>;
    if (val === '✗') return <span className="text-red-400">✗</span>;
    if (val.includes('$')) return <span className="font-medium">{val}</span>;
    return val;
  };

  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h, i) => (
              <TableHead
                key={h}
                className={cn(i === highlightColumn && 'bg-primary/5 text-primary font-bold')}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.dimension}>
              <TableHead scope="row" className="font-medium">
                {row.dimension}
              </TableHead>
              {row.values.map((val, j) => (
                <TableCell
                  key={`${row.dimension}-${j}`}
                  className={cn(j + 1 === highlightColumn && 'bg-primary/5')}
                >
                  {renderValue(val)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
