import { signingContractLabel } from "@/lib/trade/contract-type-label"
import { money } from "@/lib/player-research"
import { directSignings, transactionStatus } from "@/lib/trade/signings"
import { cn } from "cn"
import { scenarioDescriptions } from "@/lib/trade/scenario"
import { ScenarioSettings } from "./scenario-settings"
import { PayrollScenario } from "./payroll-scenario"
import { PickAsset } from "./pick-asset"
import {
  Bookmark02Icon,
  BookmarkCheckIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Icon } from "./icons"
import { ResearchAction } from "./research-action"
import { PlayerAvatar } from "./player-avatar"
import { TeamMark } from "./team-mark"
import { tradeKey, tradeTitle } from "./trade-card"
import type { TradeRecord } from "./trade-card"
import type { Player } from "@/lib/trade/types"

export function SavedTrades({
  records,
  onView,
  onRemove,
  onClose,
  onInspectPlayer,
}: {
  records: Array<TradeRecord>
  onView: (record: TradeRecord) => void
  onRemove: (record: TradeRecord) => void
  onClose: () => void
  onInspectPlayer: (player: Player) => void
}) {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Saved trades">
      <div className="research-pane-header flex h-14 min-h-14 items-center justify-between gap-2 border-b border-border pr-3.5 pl-5 [&_h2]:text-sm [&_h2]:font-medium">
        <h2>Saved trades</h2>
        <ResearchAction
          label="Close saved trades"
          icon={Cancel01Icon}
          onClick={onClose}
        />
      </div>
      {!records.length ? (
        <Empty className="min-h-0 px-6 py-8">
          <EmptyHeader className="-translate-y-6">
            <EmptyMedia variant="icon">
              <Icon icon={Bookmark02Icon} />
            </EmptyMedia>
            <EmptyTitle>No saved trades</EmptyTitle>
            <EmptyDescription>
              Bookmark a result in the conversation.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="min-h-0 flex-1" aria-label="Saved trade list">
          <ul role="list" className="flex flex-col gap-3 p-3">
            {records.map((record) => (
              <li key={tradeKey(record)}>
                <SavedTradeCard
                  record={record}
                  onView={onView}
                  onRemove={onRemove}
                  onInspectPlayer={onInspectPlayer}
                />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  )
}

function SavedTradeCard({
  record,
  onView,
  onRemove,
  onInspectPlayer,
}: {
  record: TradeRecord
  onView: (record: TradeRecord) => void
  onRemove: (record: TradeRecord) => void
  onInspectPlayer: (player: Player) => void
}) {
  const { proposal, verdict } = record.snapshot
  const displayStatus = transactionStatus(record.snapshot)
  const status =
    displayStatus === "validation_incomplete"
      ? "Checks incomplete"
      : displayStatus === "valid"
        ? proposal.transfers.length
          ? "Valid"
          : "Hypothetical"
        : verdict?.status === "invalid_trade" ||
            verdict?.status === "invalid_proposal"
          ? "Invalid"
          : "Unavailable"
  const recipients = record.teams.map((team) => ({
    team,
    picks: proposal.transfers.filter(
      (transfer) =>
        transfer.assetType === "pick" && transfer.toTeamId === team.id
    ),
    rights: proposal.transfers.filter(
      (t) => t.assetType === "draft_right" && t.toTeamId === team.id
    ),
    players: record.players.filter(
      (player) =>
        proposal.transfers.some(
          (transfer) =>
            transfer.assetType === "player" &&
            transfer.assetId === player.id &&
            transfer.toTeamId === team.id
        ) ||
        directSignings(proposal, team.id).some(
          (signing) => signing.playerId === player.id
        )
    ),
  }))
  const title = tradeTitle(record)

  return (
    <Card
      size="sm"
      className="saved-trade-card @container/saved-trade gap-0 rounded-lg py-0 shadow-none ring-border [--card-spacing:--spacing(3)] [&_.pick-avatar]:bg-muted [&_.pick-avatar]:text-foreground"
    >
      <CardHeader className="gap-1 py-3">
        <CardTitle className="min-w-0 text-balance [overflow-wrap:anywhere]">
          {title}
        </CardTitle>
        <CardDescription className="tabular-nums">{status}</CardDescription>
        <CardAction>
          <ResearchAction
            label={`Unsave ${tradeTitle(record)}`}
            icon={BookmarkCheckIcon}
            onClick={() => onRemove(record)}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="border-t border-border py-3">
        {!proposal.transfers.length ? (
          <PayrollScenario record={record} />
        ) : (
          <>
            <ScenarioSettings
              notes={scenarioDescriptions(
                { ...proposal, signings: [] },
                {
                  players: record.players,
                  teams: record.teams,
                  tradeExceptions: record.exceptions,
                }
              )}
            />
            <div className="saved-trade-recipients grid grid-cols-1 gap-5 @min-[524px]/saved-trade:grid-cols-2">
              {recipients.map(({ team, players, picks, rights }, index) => (
                <section
                  key={team.id}
                  aria-label={`${team.name} receive`}
                  className="relative flex min-w-0 flex-col gap-2"
                >
                  {index > 0 && (
                    <Separator
                      aria-hidden="true"
                      className={cn(
                        "absolute -top-2.5",
                        index === 1 && "@min-[524px]/saved-trade:hidden"
                      )}
                    />
                  )}
                  {index % 2 === 1 && (
                    <Separator
                      orientation="vertical"
                      aria-hidden="true"
                      className="absolute inset-y-0 -left-2.5 hidden @min-[524px]/saved-trade:block"
                    />
                  )}
                  <h3 className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <TeamMark team={team} size="compact" />
                    To {team.abbreviation}
                  </h3>
                  <ul
                    role="list"
                    className="flex min-w-0 flex-1 flex-col gap-2"
                  >
                    {players.length === 0 &&
                      picks.length === 0 &&
                      rights.length === 0 && (
                        <li className="text-base text-muted-foreground sm:text-sm">
                          No incoming assets
                        </li>
                      )}
                    {rights.map((transfer) => (
                      <li key={`right-${transfer.assetId}`} className="text-sm">
                        {record.rights?.find(
                          (item) => item.id === transfer.assetId
                        )?.playerName ?? "Unavailable player"}
                        <span className="block text-xs text-muted-foreground">
                          Unsigned draft rights
                        </span>
                      </li>
                    ))}
                    {picks.map((transfer) => {
                      const pick = record.picks?.find(
                        (item) => item.id === transfer.assetId
                      )
                      return (
                        <li
                          key={`pick-${transfer.assetId}`}
                          className="flex min-w-0 text-base sm:text-sm"
                        >
                          {pick ? (
                            <PickAsset
                              pick={pick}
                              teams={[
                                ...record.teams,
                                ...(record.pickTeams ?? []),
                              ]}
                              fromTeamId={transfer.fromTeamId}
                            />
                          ) : (
                            <span>
                              Pick {transfer.assetId} · Details unavailable
                            </span>
                          )}
                        </li>
                      )
                    })}
                    {players.map((player) => (
                      <li
                        key={player.id}
                        className="flex min-w-0 items-center gap-2 text-base sm:text-sm"
                      >
                        <PlayerAvatar player={player} />
                        <div className="min-w-0 [overflow-wrap:anywhere]">
                          <Button
                            type="button"
                            variant="text-link"
                            className="h-auto justify-start p-0 text-left text-[length:inherit] leading-[inherit] font-normal whitespace-normal"
                            aria-label={`View ${player.name} details`}
                            onClick={() => onInspectPlayer(player)}
                          >
                            {player.name}
                          </Button>
                          {proposal.signings?.some(
                            (signing) => signing.playerId === player.id
                          ) && (
                            <span className="block text-xs text-muted-foreground">
                              {directSignings(proposal, team.id).some(
                                (signing) => signing.playerId === player.id
                              )
                                ? "New signing"
                                : "Sign-and-trade"}{" "}
                              · {money(player.salary)}
                              {" · "}
                              {player.yearsRemaining}{" "}
                              {player.yearsRemaining === 1 ? "year" : "years"}
                              {" · "}
                              {signingContractLabel(
                                proposal.signings.find(
                                  (signing) => signing.playerId === player.id
                                )!
                              )}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
        {displayStatus === "validation_incomplete" && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Some signing requirements could not be checked. View the chat for
            details.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end border-t border-border pb-3 [.border-t]:pt-3">
        <Button variant="ghost" size="sm" onClick={() => onView(record)}>
          View in chat
        </Button>
      </CardFooter>
    </Card>
  )
}
