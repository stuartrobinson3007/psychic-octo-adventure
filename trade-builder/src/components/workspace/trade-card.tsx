import { cn } from "cn"
import { ResearchAction } from "./research-action"
import { scenarioDescriptions } from "@/lib/trade/scenario"
import { ScenarioSettings } from "./scenario-settings"
import {
  PayrollScenario,
  payrollScenarioTitle,
  payrollScenarioSummary,
} from "./payroll-scenario"
import {
  directSignings,
  signingTransfer,
  transactionStatus,
} from "@/lib/trade/signings"
import { TradePlayerAsset } from "./trade-player-asset"
import { PickAsset } from "./pick-asset"
import { assetCount } from "@/lib/trade/picks"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  ArrowDown01Icon,
  Bookmark02Icon,
  BookmarkCheckIcon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "./icons"
import { TeamMark } from "./team-mark"
import { TradeSalaryRules } from "./trade-salary-rules"
import { money } from "@/lib/player-research"
import type {
  Catalogue,
  DraftPick,
  DraftRight,
  TradeException,
  Player,
  Team,
  TradeSnapshot,
} from "@/lib/trade/types"

export interface TradeRecord {
  snapshot: TradeSnapshot
  rights?: Array<DraftRight>
  exceptions?: Array<TradeException>
  picks?: Array<DraftPick>
  pickTeams?: Array<Team>
  players: Array<Player>
  teams: Array<Team>
}
export function tradeRecord(
  snapshot: TradeSnapshot,
  catalogue: Catalogue
): TradeRecord {
  return {
    snapshot,
    rights: catalogue.draftRights?.filter((right) =>
      snapshot.proposal.transfers.some(
        (t) => t.assetType === "draft_right" && t.assetId === right.id
      )
    ),
    exceptions: catalogue.tradeExceptions,
    players: catalogue.players
      .filter(
        (player) =>
          snapshot.proposal.transfers.some(
            (t) => t.assetType === "player" && t.assetId === player.id
          ) ||
          snapshot.proposal.salaryOverrides?.some(
            (item) => item.playerId === player.id
          ) ||
          snapshot.proposal.signings?.some(
            (item) => item.playerId === player.id
          )
      )
      .map((player) => {
        const signing = snapshot.proposal.signings?.find(
          (item) => item.playerId === player.id
        )
        const override = snapshot.proposal.salaryOverrides?.find(
          (item) => item.playerId === player.id
        )
        return {
          ...player,
          salary: override?.salary ?? signing?.salary ?? player.salary,
          yearsRemaining:
            override?.yearsRemaining ??
            signing?.contractYears ??
            player.yearsRemaining,
          teamId: signing?.signingTeamId ?? player.teamId,
        }
      }),
    picks: catalogue.draftPicks?.filter((pick) =>
      snapshot.proposal.transfers.some(
        (transfer) =>
          transfer.assetType === "pick" && transfer.assetId === pick.id
      )
    ),
    pickTeams: catalogue.teams.filter((team) =>
      catalogue.draftPicks?.some(
        (pick) =>
          snapshot.proposal.transfers.some(
            (transfer) =>
              transfer.assetType === "pick" && transfer.assetId === pick.id
          ) && pick.originalTeamId === team.id
      )
    ),
    teams: snapshot.proposal.teamIds.flatMap((teamId) => {
      const team = catalogue.teams.find((item) => item.id === teamId)
      return team ? [team] : []
    }),
  }
}
export function tradeKey(record: TradeRecord) {
  return `${record.snapshot.proposal.proposalId}:${record.snapshot.proposal.revision}`
}
export function tradeTitle(record: TradeRecord, compact = true) {
  const sides = record.teams.map((team) => {
    const transfers = record.snapshot.proposal.transfers.filter(
      (transfer) => transfer.fromTeamId === team.id
    )
    const names = transfers
      .filter((transfer) => transfer.assetType === "player")
      .map(
        (transfer) =>
          record.players.find((player) => player.id === transfer.assetId)
            ?.name ?? "Unavailable player"
      )
    for (const transfer of transfers.filter(
      (item) => item.assetType !== "player"
    )) {
      if (transfer.assetType === "draft_right") {
        const right = record.rights?.find(
          (item) => item.id === transfer.assetId
        )
        names.push(`${right?.playerName ?? "Player"} draft rights`)
      } else {
        const pick = record.picks?.find((item) => item.id === transfer.assetId)
        names.push(
          pick
            ? `${pick.year} ${pick.round === 1 ? "first" : "second"}-round pick`
            : "Draft pick"
        )
      }
    }
    return names
  })
  if (!record.snapshot.proposal.transfers.length)
    return payrollScenarioTitle(record)
  if (record.teams.length > 2)
    return record.teams
      .map((team) =>
        compact ? team.abbreviation : `${team.city} ${team.name}`
      )
      .join(" · ")
  const onlyTransfer =
    record.snapshot.proposal.transfers.length === 1
      ? record.snapshot.proposal.transfers[0]
      : undefined
  if (onlyTransfer?.assetType === "player") {
    const player = record.players.find(
      (item) => item.id === onlyTransfer.assetId
    )
    const destination = record.teams.find(
      (item) => item.id === onlyTransfer.toTeamId
    )
    return `${player?.name ?? "Player"} to ${destination?.city ?? destination?.name ?? "team"}`
  }
  const separator =
    sides.length === 2 && sides.every((names) => names.length === 1)
      ? " for "
      : " ↔ "
  return sides
    .map((names) =>
      !names.length
        ? "No outgoing assets"
        : compact && names.length > 1
          ? `${names[0]} +${names.length - 1}`
          : names.join(", ")
    )
    .join(separator)
}

export function TradeCard({
  record,
  expanded,
  onExpand,
  saved,
  onSave,
  onCheck,
  onInspectPlayer,
  busy,
}: {
  record: TradeRecord
  expanded: boolean
  onExpand: () => void
  saved: boolean
  onSave: () => void
  onCheck?: () => void
  onInspectPlayer: (player: Player) => void
  busy?: boolean
}) {
  const { proposal, verdict } = record.snapshot
  const scenario = proposal.transfers.length === 0
  const scenarioNotes = scenarioDescriptions(
    {
      ...proposal,
      signings: [],
    },
    {
      players: record.players,
      teams: record.teams,
      tradeExceptions: record.exceptions,
    }
  )
  const signAndTrade = proposal.signings?.some((signing) =>
    signingTransfer(proposal, signing)
  )
  const hasDirectSigning = directSignings(proposal).length > 0
  const multiTeam = record.teams.length > 2
  const headerDescription = scenario
    ? payrollScenarioSummary(record)
    : [
        signAndTrade ? "Sign-and-trade" : undefined,
        hasDirectSigning ? "Trade + signing" : undefined,
        multiTeam ? `${record.teams.length} teams` : undefined,
        assetCount(proposal.transfers, directSignings(proposal).length),
      ]
        .filter(Boolean)
        .join(" · ")
  const displayStatus = transactionStatus(record.snapshot)
  const checksIncomplete = displayStatus === "validation_incomplete"
  const valid = displayStatus === "valid"
  const failed =
    verdict?.status === "invalid_trade" ||
    verdict?.status === "invalid_proposal"
  const summary = checksIncomplete
    ? "The available salary checks passed. Some signing requirements could not be checked."
    : valid && !scenario
      ? `${verdict?.season} ${proposal.transfers.some((item) => item.assetType === "pick") ? "salary, roster and pick" : "salary and roster"} checks passed.`
      : (verdict?.summary ?? "")
  const [summaryLead, ...summaryDetail] = summary
    .replace(/^Trade is invalid\.\s*/, "")
    .split(/(?<=\.)\s+/)
  const verdictDetails = Array.from(
    new Set([
      ...(verdict?.teams.flatMap((team) => team.violations) ?? []),
      ...(verdict?.issues ?? []),
      ...(verdict?.limitations ??
        (checksIncomplete
          ? [
              "This older result does not establish signing eligibility after the trade. The signing and trade need separate assessments.",
            ]
          : [])),
    ])
  ).filter((detail) => detail !== verdict?.summary)
  const status = !verdict
    ? "Checking…"
    : checksIncomplete
      ? "Checks incomplete"
      : valid
        ? scenario
          ? "Hypothetical"
          : "Valid"
        : failed
          ? "Invalid"
          : "Unavailable"
  return (
    <Collapsible
      open={expanded}
      onOpenChange={onExpand}
      className="group/trade t-acc w-full"
      data-open={expanded}
      id={`trade-${proposal.proposalId}-${proposal.revision}`}
    >
      <Card
        size="sm"
        className="trade-card @container/trade-card ring-inset min-[1200px]:overflow-visible"
      >
        <CardHeader className="relative flex flex-row items-center gap-2">
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start py-3 whitespace-normal aria-expanded:not-hover:bg-transparent"
              />
            }
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${tradeTitle(record, false)}`}
          >
            <div className="trade-team-marks flex shrink-0 gap-2 @max-[480px]/trade-card:hidden">
              {record.teams.map((team) => (
                <TeamMark key={team.id} team={team} />
              ))}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <CardTitle
                className="line-clamp-2"
                title={tradeTitle(record, false)}
              >
                {tradeTitle(record)}
              </CardTitle>
              {headerDescription && (
                <CardDescription>{headerDescription}</CardDescription>
              )}
            </div>
            <Badge
              variant={
                valid && scenario
                  ? "secondary"
                  : valid
                    ? "default"
                    : failed
                      ? "destructive"
                      : verdict
                        ? "warning"
                        : "secondary"
              }
            >
              {status}
            </Badge>
            <span className="t-acc-chevron">
              <Icon icon={ArrowDown01Icon} data-icon="inline-start" />
            </span>
          </CollapsibleTrigger>
          {verdict && (
            <ResearchAction
              label={saved ? "Unsave trade" : "Save trade"}
              icon={saved ? BookmarkCheckIcon : Bookmark02Icon}
              size="icon-sm"
              className={cn(
                "shrink-0 min-[1200px]:absolute min-[1200px]:top-1/2 min-[1200px]:left-[calc(100%+4px)] min-[1200px]:-translate-y-1/2",
                !saved &&
                  "group-hover/trade:opacity-100 focus-visible:opacity-100 [@media(min-width:1200px)_and_(hover:hover)_and_(pointer:fine)]:opacity-0"
              )}
              aria-pressed={saved}
              onClick={onSave}
            />
          )}
        </CardHeader>
        <CollapsibleContent className="trade-panel">
          <Separator className="mb-4" />
          <CardContent>
            {scenario ? (
              <PayrollScenario record={record} />
            ) : (
              <>
                <ScenarioSettings notes={scenarioNotes} />
                <ScrollArea
                  className="trade-recipients-scroll min-w-0"
                  data-multi-team={multiTeam}
                  scrollbarOrientation="horizontal"
                  viewportRender={
                    <div
                      role="region"
                      aria-label="Trade team columns"
                      tabIndex={0}
                    />
                  }
                >
                  <div
                    className={cn(
                      "trade-recipients grid grid-cols-2 gap-x-6 max-md:gap-x-4 @max-[480px]/trade-card:grid-cols-1 @max-[480px]/trade-card:gap-y-6",
                      multiTeam &&
                        "auto-cols-[max(240px,calc((100%-120px)/2))] grid-flow-col grid-cols-none pb-4 @max-[480px]/trade-card:auto-cols-[min(280px,calc(100%-64px))] @max-[480px]/trade-card:grid-cols-none @max-[480px]/trade-card:gap-y-0"
                    )}
                  >
                    {record.teams.map((team) => {
                      const received = proposal.transfers.filter(
                        (transfer) => transfer.toTeamId === team.id
                      )
                      const signed = directSignings(proposal, team.id)
                      const signingSalary = signed.reduce(
                        (sum, signing) =>
                          sum +
                          (record.players.find(
                            (player) => player.id === signing.playerId
                          )?.salary ?? signing.salary),
                        0
                      )
                      const sent = proposal.transfers.filter(
                        (transfer) => transfer.fromTeamId === team.id
                      )
                      const evidence = verdict?.teams.find(
                        (item) => item.teamId === team.id
                      )
                      const incoming = received
                        .filter((transfer) => transfer.assetType === "player")
                        .reduce(
                          (sum, transfer) =>
                            sum +
                            (record.players.find(
                              (player) => player.id === transfer.assetId
                            )?.salary ?? 0),
                          0
                        )
                      const outgoing = sent
                        .filter((transfer) => transfer.assetType === "player")
                        .reduce(
                          (sum, transfer) =>
                            sum +
                            (record.players.find(
                              (player) => player.id === transfer.assetId
                            )?.salary ?? 0),
                          0
                        )
                      return (
                        <section
                          key={team.id}
                          className={cn(
                            "trade-team row-span-8 grid grid-rows-subgrid @max-[480px]/trade-card:row-auto @max-[480px]/trade-card:grid-rows-[auto_auto_auto_repeat(4,auto)_auto]",
                            hasDirectSigning &&
                              "row-span-9 @max-[480px]/trade-card:grid-rows-[auto_auto_auto_repeat(5,auto)_auto]",
                            multiTeam &&
                              "row-[1/span_8] min-w-0 @max-[480px]/trade-card:row-[1/span_8] @max-[480px]/trade-card:grid-rows-subgrid",
                            multiTeam &&
                              hasDirectSigning &&
                              "row-[1/span_9] @max-[480px]/trade-card:row-[1/span_9]"
                          )}
                        >
                          <h3 className="flex items-center gap-2 py-2.5 text-xs font-medium">
                            <TeamMark team={team} size="compact" />
                            {team.name} receive
                          </h3>
                          <ul
                            role="list"
                            className="trade-assets m-0 list-none p-0 leading-data [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:justify-between [&_li]:gap-x-2 [&_li]:gap-y-[3px] [&_li]:py-1.5 [&_li]:text-[13px]"
                          >
                            {!received.length && !signed.length && (
                              <li className="muted text-muted-foreground">
                                No assets received
                              </li>
                            )}
                            {received.map((transfer) => {
                              if (transfer.assetType === "draft_right") {
                                const right = record.rights?.find(
                                  (item) => item.id === transfer.assetId
                                )
                                return (
                                  <li key={`right-${transfer.assetId}`}>
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                      <Avatar
                                        className="size-12"
                                        aria-hidden="true"
                                      >
                                        <AvatarFallback className="text-xs">
                                          {right?.playerName
                                            .split(/\s+/)
                                            .slice(0, 2)
                                            .map((part) => part[0])
                                            .join("") ?? "?"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="min-w-0">
                                        {right?.playerName ??
                                          "Unavailable player"}
                                        <span className="block text-xs text-muted-foreground">
                                          Unsigned draft rights · From{" "}
                                          {
                                            record.teams.find(
                                              (item) =>
                                                item.id === transfer.fromTeamId
                                            )?.abbreviation
                                          }
                                        </span>
                                      </span>
                                    </div>
                                    <span className="muted text-muted-foreground">
                                      $0
                                    </span>
                                  </li>
                                )
                              }
                              if (transfer.assetType === "pick") {
                                const pick = record.picks?.find(
                                  (item) => item.id === transfer.assetId
                                )
                                return (
                                  <li key={`pick-${transfer.assetId}`}>
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
                                        Pick {transfer.assetId} · Details
                                        unavailable
                                      </span>
                                    )}
                                  </li>
                                )
                              }
                              const player = record.players.find(
                                (item) => item.id === transfer.assetId
                              )
                              const hypotheticalSalary =
                                proposal.salaryOverrides?.some(
                                  (item) => item.playerId === transfer.assetId
                                ) ||
                                proposal.signings?.some(
                                  (item) => item.playerId === transfer.assetId
                                )
                              const signing = proposal.signings?.find(
                                (item) => item.playerId === transfer.assetId
                              )
                              return (
                                <TradePlayerAsset
                                  key={`player-${transfer.assetId}`}
                                  player={player}
                                  signing={signing}
                                  from={
                                    multiTeam || signing
                                      ? record.teams.find(
                                          (item) =>
                                            item.id === transfer.fromTeamId
                                        )?.abbreviation
                                      : undefined
                                  }
                                  hypothetical={Boolean(hypotheticalSalary)}
                                  onInspect={onInspectPlayer}
                                />
                              )
                            })}
                            {signed.map((signing) => (
                              <TradePlayerAsset
                                key={`signing-${signing.playerId}`}
                                player={record.players.find(
                                  (player) => player.id === signing.playerId
                                )}
                                signing={signing}
                                direct
                                onInspect={onInspectPlayer}
                              />
                            ))}
                          </ul>
                          <Separator className="my-3" />
                          <div
                            className={cn(
                              "trade-math row-span-4 grid grid-rows-subgrid text-xs leading-data tabular-nums [&>div]:flex [&>div]:justify-between [&>div]:gap-2 [&>div+div]:pt-1.5 [&>div>span:first-child]:text-muted-foreground",
                              hasDirectSigning && "row-span-5"
                            )}
                          >
                            <div>
                              <span>
                                {hasDirectSigning ? "Trade in" : "In"}
                              </span>
                              <span>
                                {money(evidence?.salaryIn ?? incoming)}
                              </span>
                            </div>
                            <div>
                              <span>
                                {hasDirectSigning ? "Trade out" : "Out"}
                              </span>
                              <span>
                                {money(evidence?.salaryOut ?? outgoing)}
                              </span>
                            </div>
                            <div>
                              <span>
                                {hasDirectSigning ? "Trade change" : "Change"}
                              </span>
                              <span>
                                {(evidence?.netSalaryChange ??
                                  incoming - outgoing) > 0
                                  ? "+"
                                  : ""}
                                {money(
                                  evidence?.netSalaryChange ??
                                    incoming - outgoing
                                )}
                              </span>
                            </div>
                            {hasDirectSigning && (
                              <div>
                                <span>Signing</span>
                                <span>{money(signingSalary)}</span>
                              </div>
                            )}
                            {evidence && (
                              <div>
                                <span>Payroll after</span>
                                <span>{money(evidence.newTotalSalary)}</span>
                              </div>
                            )}
                          </div>
                          {evidence && (
                            <div className="trade-cap-position pt-2 text-[11px] leading-label text-muted-foreground">
                              {evidence.newCapStatus}
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
            {verdict && !(scenario && valid) && (
              <div className="flex flex-col gap-3">
                <Separator />
                <Alert
                  variant={
                    valid ? "success" : failed ? "destructive" : "warning"
                  }
                  role={valid ? "status" : "alert"}
                >
                  <Icon
                    icon={valid ? CheckmarkCircle01Icon : AlertCircleIcon}
                    data-icon="inline-start"
                  />
                  <AlertDescription className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-medium">{summaryLead}</span>
                    {(summaryDetail.length > 0 ||
                      verdictDetails.length > 0) && (
                      <div className="mt-2">
                        {summaryDetail.length > 0 && (
                          <p>{summaryDetail.join(" ")}</p>
                        )}
                        <ul
                          role="list"
                          className="mt-2 list-disc space-y-2 pl-4"
                        >
                          {verdictDetails.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
                <TradeSalaryRules verdict={verdict} />
              </div>
            )}
          </CardContent>
          {onCheck && verdict?.status === "validation_unavailable" && (
            <CardFooter className="pt-4">
              <Button type="button" size="sm" onClick={onCheck} disabled={busy}>
                {busy && <Spinner data-icon="inline-start" />}
                {busy ? "Checking…" : "Retry check"}
              </Button>
            </CardFooter>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
