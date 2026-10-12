export function ScenarioSettings({ notes }: { notes: Array<string> }) {
  if (!notes.length) return null

  return (
    <section
      aria-label="Scenario settings"
      className="mb-4 rounded-lg bg-muted p-3 sm:p-4"
    >
      <h3 className="mb-2 text-sm leading-5 font-medium text-foreground">
        Scenario settings
      </h3>
      <ul className="flex list-disc flex-col gap-2 pl-4 text-[13px] leading-5 text-secondary-foreground marker:text-muted-foreground">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
