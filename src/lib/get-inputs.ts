import * as CoreLibrary from "@actions/core";

enum INPUT_TYPE {
  string = "STRING",
  boolean = "BOOLEAN",
  reasonList = "REASON_LIST",
  repositoryList = "REPOSITORY_LIST",
}

export enum INPUTS {
  actionSchedule = "action-schedule",
  githubToken = "github-token",
  slackToken = "slack-token",
  slackDestination = "slack-destination",
  webexToken = "webex-token",
  webexEmail = "webex-email",
  filterIncludeReasons = "filter-include-reasons",
  filterExcludeReasons = "filter-exclude-reasons",
  filterIncludeRepositories = "filter-include-repositories",
  filterExcludeRepositories = "filter-exclude-repositories",
  filterOnlyParticipating = "filter-only-participating",
  filterOnlyUnread = "filter-only-unread",
  markAsRead = "mark-as-read",
  sortOldestFirst = "sort-oldest-first",
  timezone = "timezone",
  dateFormat = "date-format",
  timeFormat = "time-format",
  sinceLastRun = "since-last-run",
  paginateAll = "paginate-all",
  rollupNotifications = "rollup-notifications",
  debugLogging = "debug-logging",
}

export enum REASONS {
  ASSIGN = "assign",
  AUTHOR = "author",
  CI_ACTIVITY = "ci_activity",
  COMMENT = "comment",
  MANUAL = "manual",
  MENTION = "mention",
  PUSH = "push",
  REVIEW_REQUESTED = "review_requested",
  SECURITY_ALERT = "security_alert",
  STATE_CHANGE = "state_change",
  SUBSCRIBED = "subscribed",
  TEAM_MENTION = "team_mention",
  YOUR_ACTIVITY = "your_activity",
};

/**
 * Parses, validates, transforms, and returns all action inputs as an object
 */
function getInputs(core: typeof CoreLibrary) {
  // Getter and validator for each individual input
  function getInput(
    name: string,
    type: INPUT_TYPE.boolean,
    required: boolean
  ): boolean;
  function getInput(
    name: string,
    type: INPUT_TYPE.reasonList | INPUT_TYPE.repositoryList,
    required: boolean
  ): Array<string>;
  function getInput(
    name: string,
    type: INPUT_TYPE.string,
    required: boolean
  ): string;
  function getInput(
    name: string,
    type: INPUT_TYPE,
    required: boolean
  ): boolean | Array<string> | string {
    const reasonsArr = Object.values(REASONS);

    let input;
    if (type === INPUT_TYPE.string) {
      input = core.getInput(name, { required });
      // Validate
      if (required && !input) {
        throw new Error(`Input <${name}> is a required string.`);
      }
    } else if (type === INPUT_TYPE.boolean) {
      input = core.getBooleanInput(name, { required });
      // Validate
      if (required && !input) {
        throw new Error(`Input <${name}> is a required boolean.`);
      }
    } else if (
      type === INPUT_TYPE.reasonList ||
      type === INPUT_TYPE.repositoryList
    ) {
      input = core.getInput(name, { required });
      if (input) {
        input = input.split(",").map((opt: string) => opt.trim().toLowerCase()).filter(x => x);
        // Validate
        if (required && !input) {
          throw new Error(
            `Input <${name}> is a required comma-separated list.`
          );
        }
        if (input?.length) {
          // Validate that array only contains "reason" values if reason
          if (type === INPUT_TYPE.reasonList) {
            const allPass = input.every((reason: string) => {
              if (!reasonsArr.includes(reason.toLowerCase() as REASONS)) {
                core.error(
                  `"${reason}" is not a valid notification reason type. Please refer to "Filtering Inputs" in README.md.`
                );
                return false;
              }
              return true;
            });
            if (!allPass) {
              throw new Error(
                `Invalid reason in filter input. Valid reasons: [${reasonsArr.join(
                  ", "
                )}]`
              );
            }
          } else if (type === INPUT_TYPE.repositoryList) {
            const allPass = input.every((repository: string) => {
              if (!repository.match(/([A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]*)/g)) {
                core.error(
                  `"${repository}" is not a valid repository name. Must be in the form owner/repo.`
                );
                return false

              }
              return true;
            });
            if (!allPass) {
              throw new Error(
                `Invalid repository in filter input. Must be in form "owner/repo" e.g. "Ebonsignori/github-notifications-slack-forwarder"`
              );
            }
          }
        }
      }
    } else {
      throw new Error("Internal error: invalid inputType, ${type}");
    }

    return input;
  }

  // All inputs
  const allInputs = {
    actionSchedule: getInput(INPUTS.actionSchedule, INPUT_TYPE.string, true),
    githubToken: getInput(INPUTS.githubToken, INPUT_TYPE.string, true),
    webexToken: getInput(INPUTS.webexToken, INPUT_TYPE.string, false),
    webexEmail: getInput(INPUTS.webexEmail, INPUT_TYPE.string, false),
    slackToken: getInput(INPUTS.slackToken, INPUT_TYPE.string, false),
    slackDestination: getInput(INPUTS.slackDestination, INPUT_TYPE.string, false),
    filterIncludeReasons: getInput(
      INPUTS.filterIncludeReasons,
      INPUT_TYPE.reasonList,
      false,
    ),
    filterExcludeReasons: getInput(
      INPUTS.filterExcludeReasons,
      INPUT_TYPE.reasonList,
      false,
    ),
    filterIncludeRepositories: getInput(
      INPUTS.filterIncludeRepositories,
      INPUT_TYPE.repositoryList,
      false
    ),
    filterExcludeRepositories: getInput(
      INPUTS.filterExcludeRepositories,
      INPUT_TYPE.repositoryList,
      false
    ),
    filterOnlyParticipating: getInput(
      INPUTS.filterOnlyParticipating,
      INPUT_TYPE.boolean,
      false
    ),
    filterOnlyUnread: getInput(
      INPUTS.filterOnlyUnread,
      INPUT_TYPE.boolean,
      false
    ),
    markAsRead: getInput(INPUTS.markAsRead, INPUT_TYPE.boolean, false),
    sortOldestFirst: getInput(INPUTS.sortOldestFirst, INPUT_TYPE.boolean, false),
    timezone: getInput(INPUTS.timezone, INPUT_TYPE.string, false),
    dateFormat: getInput(INPUTS.dateFormat, INPUT_TYPE.string, false),
    timeFormat: getInput(INPUTS.timeFormat, INPUT_TYPE.string, false),
    sinceLastRun: getInput(INPUTS.sinceLastRun, INPUT_TYPE.boolean, false),
    paginateAll: getInput(INPUTS.paginateAll, INPUT_TYPE.boolean, false),
    rollupNotifications: getInput(
      INPUTS.rollupNotifications,
      INPUT_TYPE.boolean,
      false
    ),
    debugLogging: getInput(
      INPUTS.debugLogging,
      INPUT_TYPE.boolean,
      false
    ),
  };

  if (process.env.ACTIONS_STEP_DEBUG) {
    allInputs.debugLogging = true;
  }

  // - - -
  // Extra validation for inputs
  // - - -
  // Require either Slack or Webex to be configured
  if (!allInputs.slackToken && !allInputs.webexToken) {
    throw new Error(
      "You must provide either a <slack-token> or <webex-token>. Please see the README for more information."
    );
  }

  if (allInputs.slackToken && !allInputs.slackDestination) {
    throw new Error(
      "You must provide a <slack-destination> when forwarding notifications to Slack. Please see the README for more information."
    )
  }

  if (allInputs.webexToken && !allInputs.webexEmail) {
    throw new Error(
      "You must provide a <webex-email> when forwarding notifications to Webex. Please see the README for more information."
    )
  }

  return allInputs;
}

export default getInputs;
