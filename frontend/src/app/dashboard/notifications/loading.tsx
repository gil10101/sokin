import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-dark text-cream">
      <LoadingSpinner size="lg" />
    </div>
  )
}

