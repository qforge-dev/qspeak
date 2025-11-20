import { useTranslation } from "react-i18next";
import { SettingsCard, SettingsCardContent, SettingsCardHeader, SettingsCardTitle } from "../components/cards";
import { OptionTitle, OptionContent, OptionWrapper, OptionIcon } from "../components/layout";
import { useAppState } from "@renderer/hooks/useAppState";
import { Star, Mic, UserCircle, Image } from "lucide-react";
import { HistoryHeading, HistoryMain } from "../components/history/history-layout";
import { HistoryHeader } from "../components/history/history-layout";
import { Badge } from "@renderer/components/badge";
import { useVersion } from "@renderer/hooks/useVersion";
import { CardDescription } from "@renderer/components/card";
import { getShortcut, Shortcut } from "@renderer/utils/shortcut";
import { Button } from "@renderer/components/button";
import { DiscordSvg } from "@renderer/icons/discord-svg";
import { useQSpeakLinks } from "@renderer/hooks/useQSpeakLinks";
import { openPath } from "@tauri-apps/plugin-opener";
import { LinkedInSvg } from "@renderer/icons/linkedin-svg";
import {
  ChallangeContentHeader,
  ChallengeContent,
  ChallengeDescription,
  ChallengeLinearProgress,
  ChallengeProgress,
} from "../components/challenges";
import { ChallengeItem } from "../components/challenges";
import { ChallengeStatus, ChallengeTitle } from "../components/challenges";
import { ChallengesWrapper } from "../components/challenges";
import { ShortcutKey } from "@renderer/components/shortcut";
import { cn } from "@renderer/utils/cn";
import { isProgressGoalCondition } from "@renderer/hooks/useNewState";

export function Home() {
  const { t } = useTranslation();
  const { state } = useAppState();

  const version = useVersion();
  const { discord, linkedin, website } = useQSpeakLinks();

  const goToDiscord = () => {
    openPath(discord);
  };

  const goToLinkedin = () => {
    openPath(linkedin);
  };

  const goToWebsite = () => {
    openPath(website);
  };

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-2 user-select-none cursor-grab" data-tauri-drag-region>
        <div className="flex items-center justify-between user-select-none" data-tauri-drag-region>
          <HistoryHeading>{t("WelcomeBack")} 👋</HistoryHeading>

          <div className="flex items-center gap-4">
            <Badge variant="outline">
              <Star className="size-3 mr-1" /> {t("Version")} {version}
            </Badge>

            <p className="text-foreground">{state?.context?.account_context?.account?.email}</p>
          </div>
        </div>

        <SettingsCard className="flex items-center bg-transparent mt-6 justify-between">
          <SettingsCardHeader className="p-0 max-w-sm">
            <CardDescription>{t("StayUpdated")}</CardDescription>

            <CardDescription className="underline cursor-pointer" onClick={goToWebsite}>
              {t("VisitOurWebsite")}
            </CardDescription>
          </SettingsCardHeader>

          <SettingsCardContent className="divide-none p-0">
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={goToDiscord} fullWidth>
                <DiscordSvg /> Discord
              </Button>
              <Button variant="secondary" size="sm" onClick={goToLinkedin} fullWidth>
                <LinkedInSvg /> LinkedIn
              </Button>
            </div>
          </SettingsCardContent>
        </SettingsCard>

        <div className="grid grid-cols-3 gap-4 w-full mt-6">
          <SettingsCard>
            <SettingsCardContent className="p-3">
              <OptionWrapper className="pb-1">
                <OptionContent className="flex-row items-center gap-1">
                  <OptionIcon>
                    <Mic />
                  </OptionIcon>
                  <OptionTitle>{t("Record")}</OptionTitle>
                </OptionContent>

                <ShortcutItem shortcut={state?.context.shortcuts.recording ?? []} />
              </OptionWrapper>
            </SettingsCardContent>
          </SettingsCard>
          <SettingsCard>
            <SettingsCardContent className="p-3">
              <OptionWrapper className="pb-1">
                <OptionContent className="flex-row items-center gap-1">
                  <OptionIcon>
                    <UserCircle />
                  </OptionIcon>
                  <OptionTitle>{t("Personas")}</OptionTitle>
                </OptionContent>
                <ShortcutItem shortcut={state?.context.shortcuts.personas ?? []} />
              </OptionWrapper>
            </SettingsCardContent>
          </SettingsCard>
          <SettingsCard>
            <SettingsCardContent className="p-3">
              <OptionWrapper className="pb-1">
                <OptionContent className="flex-row items-center gap-1">
                  <OptionIcon>
                    <Image />
                  </OptionIcon>
                  <OptionTitle>{t("Screenshot")}</OptionTitle>
                </OptionContent>
                <ShortcutItem shortcut={state?.context.shortcuts.screenshot ?? []} />
              </OptionWrapper>
            </SettingsCardContent>
          </SettingsCard>
        </div>
      </HistoryHeader>

      <div className="mx-auto w-full flex flex-col gap-4 px-6 py-2">
        <SettingsCard className="flex flex-col bg-transparent mt-4">
          <SettingsCardHeader className="flex items-center justify-between flex-row p-0 mb-4">
            <SettingsCardTitle className="flex items-center mb-0">{t("QuickChallenges")}</SettingsCardTitle>

            <ChallengeProgress>
              <ChallengeLinearProgress
                progress={
                  state?.context?.challenge_context?.challenges.filter((challenge) => challenge.status === "Completed")
                    .length || 0
                }
                target={state?.context?.challenge_context?.challenges.length || 0}
              />
            </ChallengeProgress>
          </SettingsCardHeader>

          <SettingsCardContent className="divide-none p-0 relative grow">
            <div className="absolute -top-1 left-0 right-0 bg-linear-to-b from-background to-background-surface/20 h-8 pointer-events-none z-[2] " />
            <div className="absolute -bottom-1 left-0 right-0 bg-linear-to-t from-background to-background-surface/20 h-8 pointer-events-none z-[2] " />
            <ChallengesWrapper className="overflow-y-auto max-h-[360px] pr-1 relative">
              {state?.context?.challenge_context?.challenges
                .sort((a) => (a.status === "Completed" ? -1 : 1))
                .map((challenge) => {
                  const progressRequirement = challenge.requirements?.find(
                    (req) =>
                      typeof req.condition === "object" &&
                      "type" in req.condition &&
                      req.condition.type === "ProgressGoal",
                  );

                  return (
                    <ChallengeItem key={challenge.id}>
                      <ChallengeStatus status={challenge.status} />

                      <ChallengeContent>
                        <ChallangeContentHeader>
                          <ChallengeTitle>{challenge.title}</ChallengeTitle>
                          <ChallengeDescription>{challenge.description}</ChallengeDescription>
                        </ChallangeContentHeader>

                        {progressRequirement && isProgressGoalCondition(progressRequirement.condition) && (
                          <ChallengeLinearProgress
                            progress={
                              (progressRequirement.current_progress || 0) * progressRequirement.condition.target
                            }
                            target={progressRequirement.condition.target}
                          />
                        )}
                      </ChallengeContent>
                    </ChallengeItem>
                  );
                })}
            </ChallengesWrapper>
          </SettingsCardContent>
        </SettingsCard>
        {/* 
        <SettingsCard>
          <SettingsCardHeader>
            <SettingsCardTitle className="flex items-center gap-2">
              <History className="size-4" /> {t("ReleaseNotes")}
            </SettingsCardTitle>
          </SettingsCardHeader>

          <SettingsCardContent className="divide-none px-2">
            <ChangelogWrapper>
              {changelog.slice(0, 14).map((item, index) => {
                return (
                  <Changelog key={item.version} className="[&:not(:last-child)]:pb-4">
                    <ChangelogHeader>
                      <ChangelogVersion>v{item.version}</ChangelogVersion>

                      {index === 0 && <Badge variant="outline">Latest</Badge>}
                      <ChangelogDate>{CustomDate.format(item.date, "MMM d, yyyy")}</ChangelogDate>
                    </ChangelogHeader>

                    <ChangelogList items={item.changes} />
                  </Changelog>
                );
              })}
            </ChangelogWrapper>
          </SettingsCardContent>
        </SettingsCard> */}
      </div>
    </HistoryMain>
  );
}

function ShortcutItem({
  shortcut,
  className,
  itemClassName,
}: {
  shortcut: string[];
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {getShortcut(shortcut).keys.map((key) => (
        <ShortcutKey key={key} className={cn("", itemClassName)}>
          {Shortcut.keyToIcon(key)}
        </ShortcutKey>
      ))}
    </div>
  );
}
