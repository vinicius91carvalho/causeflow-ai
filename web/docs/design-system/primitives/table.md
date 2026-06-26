# Table

Styled wrappers around native table elements. No sorting, filtering, or virtualization — wire those into the consuming component.

## When to use
- Displaying tabular data with multiple columns of comparable fields
- Lists where row hover and per-cell alignment matter

## When NOT to use
- For simple key/value pairs — use a definition list or flex layout
- For card-style lists — use `Card`
- For huge datasets — pair with a virtualization library at the `TableBody` level

## Parts
| Part | Renders | Notes |
|---|---|---|
| `Table` | `<div class="overflow-auto"><table>` | Auto horizontal scroll when overflowed |
| `TableHeader` | `<thead>` | Adds bottom border on rows |
| `TableBody` | `<tbody>` | Removes border on last row |
| `TableFooter` | `<tfoot>` | Muted background, medium weight |
| `TableRow` | `<tr>` | Hover background, `data-[state=selected]` support |
| `TableHead` | `<th>` | `h-12 px-4 text-left`, muted foreground |
| `TableCell` | `<td>` | `p-4 align-middle` |
| `TableCaption` | `<caption>` | Rendered below the table (`caption-bottom`) |

All parts accept the native element attributes plus `className`.

## Examples
```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@causeflow/ui"

<Table>
  <TableCaption>Recent invoices</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV-0001</TableCell>
      <TableCell><Badge>Paid</Badge></TableCell>
      <TableCell className="text-right">$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Accessibility
- Uses semantic table elements, so screen readers announce columns/rows correctly
- Always include `TableCaption` or wrap the table in a labelled region
- For selectable rows, set `data-state="selected"` and pair with `aria-selected` on `<TableRow>`
- For checkbox cells, the cell removes right padding when a `[role=checkbox]` is inside

## Source
`packages/ui/src/presentation/primitives/table.tsx`
