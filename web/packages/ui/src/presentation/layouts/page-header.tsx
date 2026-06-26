interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  );
}
