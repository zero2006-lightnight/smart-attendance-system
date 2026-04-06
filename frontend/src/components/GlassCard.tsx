interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div className={`glass-card p-4 ${className}`}>
      {children}
    </div>
  );
}
