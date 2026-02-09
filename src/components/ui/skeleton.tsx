import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-100", className)}
      {...props}
    />
  )
}

// Enhanced skeleton with shimmer effect for BlueOx design
function ShimmerSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

// Card skeleton for dashboard cards
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl", className)}>
      <div className="flex items-center gap-4 mb-4">
        <ShimmerSkeleton className="w-12 h-12 rounded-2xl" />
        <div className="flex-1">
          <ShimmerSkeleton className="h-4 w-24 mb-2" />
          <ShimmerSkeleton className="h-3 w-32" />
        </div>
      </div>
      <ShimmerSkeleton className="h-8 w-20 mb-2" />
      <ShimmerSkeleton className="h-4 w-28" />
    </div>
  )
}

// Table row skeleton
function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200/50">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <ShimmerSkeleton className={cn(
            "h-4",
            i === 0 ? "w-32" : i === columns - 1 ? "w-16" : "w-24"
          )} />
        </td>
      ))}
    </tr>
  )
}

// Form field skeleton
function FormFieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <ShimmerSkeleton className="h-4 w-20" />
      <ShimmerSkeleton className="h-11 w-full rounded-xl" />
    </div>
  )
}

// Stats card skeleton for dashboard
function StatsCardSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
      <div className="flex items-center gap-4 mb-4">
        <ShimmerSkeleton className="w-10 h-10 rounded-2xl" />
        <div className="flex-1">
          <ShimmerSkeleton className="h-3 w-16 mb-2" />
        </div>
      </div>
      <ShimmerSkeleton className="h-8 w-24 mb-2" />
      <ShimmerSkeleton className="h-4 w-20" />
    </div>
  )
}

// Navigation skeleton
function NavSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
      <ShimmerSkeleton className="h-5 w-24 mb-6" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-2xl">
            <ShimmerSkeleton className="w-8 h-8 rounded-xl" />
            <ShimmerSkeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Page header skeleton
function PageHeaderSkeleton() {
  return (
    <div className="text-center lg:text-left">
      <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl px-6 py-3 shadow-lg mb-6">
        <ShimmerSkeleton className="w-6 h-6 rounded-full" />
        <ShimmerSkeleton className="h-4 w-32" />
      </div>
      
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <ShimmerSkeleton className="h-10 w-64 mb-4" />
          <ShimmerSkeleton className="h-5 w-96" />
        </div>
        <ShimmerSkeleton className="h-12 w-40 rounded-2xl" />
      </div>
    </div>
  )
}

export { 
  Skeleton, 
  ShimmerSkeleton, 
  CardSkeleton, 
  TableRowSkeleton, 
  FormFieldSkeleton,
  StatsCardSkeleton,
  NavSkeleton,
  PageHeaderSkeleton
}