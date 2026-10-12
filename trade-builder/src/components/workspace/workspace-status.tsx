import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

const centered =
  "gambit-app isolate flex h-dvh flex-col items-center justify-center text-sm leading-data text-foreground antialiased selection:bg-primary/18 max-md:text-base"

export function WorkspaceLoading() {
  return (
    <div className={centered}>
      <Spinner
        className="size-5 text-muted-foreground"
        aria-label="Loading chat"
      />
    </div>
  )
}
export function WorkspaceDataError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={centered}>
      <Alert className="max-w-md" variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-4">
          Trade data could not be loaded.
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
export function ConversationConnectionError({
  onRetry,
}: {
  onRetry: () => void
}) {
  return (
    <Alert className="connection-notice mx-auto mt-4 mb-3">
      <AlertDescription className="flex min-w-0 items-center justify-between gap-4">
        <span className="min-w-0">Your conversation couldn’t be loaded.</span>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={onRetry}
        >
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  )
}
