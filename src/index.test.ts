import * as CoreLibrary from "@actions/core";
import test from "ava";
import sinon from "sinon";
import { Endpoints } from "@octokit/types";
import MockDate from "mockdate";

import run from "./index.js";
import { INPUTS, REASONS } from "./lib/get-inputs.js";

const defaultEnv = {
  "action-schedule": "0 */3 * * *",
  "github-token": "<github-token>",
  "webex-token": "<webex-token>",
  "webex-email": "<webex-email>",
  "slack-token": "<slack-token>",
  "slack-destination": "<slack-destination>",
  "filter-include-reasons":
    "assign, author, ci_activity, comment, manual, mention, push, review_requested, security_alert, state_change, subscribed, team_mention, your_activity",
  "filter-exclude-reasons": "",
  "filter-include-repositories": "",
  "filter-exclude-repositories": "",
  "filter-only-participating": "false",
  "filter-only-unread": "true",
  "mark-as-read": "false",
  "sort-oldest-first": "true",
  timezone: "UTC",
  "date-format": "M/D h:ma",
  "time-format": "h:ma",
  "rollup-notifications": "true",
  "since-last-run": "true",
  "paginate-all": "false",
  "debug-logging": "false",
};

function setMockEnv(envMap: { [key: string]: any }) {
  // Clear existing env
  for (const input of Object.values(INPUTS)) {
    process.env[input] = "";
  }

  // Override defaults
  envMap = {
    ...defaultEnv,
    ...envMap,
  };

  // Set new env
  for (const [key, value] of Object.entries(envMap)) {
    process.env[`INPUT_${key.replace(/ /g, "_").toUpperCase()}`] = value;
  }
}

function mockGetCore() {
  // Toggle comment/uncomment with existing core for logging in testing
  // const core = {
  //   info: sinon.stub().callsFake((args) => console.log(args)),
  //   error: sinon.stub().callsFake((args) => console.log(args)),
  //   debug: sinon.stub().callsFake((args) => console.log(args)),
  //   getInput: CoreLibrary.getInput,
  //   getBooleanInput: CoreLibrary.getBooleanInput,
  //   setFailed: sinon.stub().callsFake((args) => console.log(args)),
  // };
  const core = {
    info: sinon.stub().callsFake((args) => {}),
    error: sinon.stub().callsFake((args) => {}),
    debug: sinon.stub().callsFake((args) => {}),
    getInput: CoreLibrary.getInput,
    getBooleanInput: CoreLibrary.getBooleanInput,
    setFailed: sinon.stub().callsFake((args) => {}),
  };
  return () => core;
}

function mockGetOctokit(
  notifications?: Endpoints["GET /notifications"]["response"]["data"]
) {
  const octokit = {
    request: sinon.stub().callsFake(async (arg) => ({ data: { html_url: `<${arg} html_url>` } })),
    rest: {
      activity: {
        listNotificationsForAuthenticatedUser: sinon
          .stub()
          .resolves({ data: notifications }),
        markThreadAsRead: sinon
          .stub()
      },
    },
    paginate: sinon.stub().resolves(notifications),
  };
  return () => octokit;
}

function mockGetSlack() {
  const slack = {
    chat: {
      postMessage: sinon.stub(),
    },
  };
  return () => slack;
}

function mockGetWebex() {
  const webex = {
    messages: {
      create: sinon.stub(),
    },
  };
  return () => webex;
}

function createMockNotification(title: string, repository: string, reason: REASONS): Endpoints["GET /notifications"]["response"]["data"][0] {
  const notification = {
    id: `<id for - "${title}">`,
    updated_at: new Date().toISOString(),
    url: `<url for - "${title}">`,
    reason: reason,
    subject: {
      title: title,
      url: `<subject url for - "${title}">`,
    },
    repository: {
      full_name: repository,
      name: repository.split("/")?.[1] || repository,
      html_url: `<repository url for - "${repository}">`,
    }
  }

  return notification as Endpoints["GET /notifications"]["response"]["data"][0]
}

test("errors when required argument is omitted", async (t) => {
  setMockEnv({
    "github-token": "",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit();
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(
    core.setFailed.calledWithMatch(
      "Input required and not supplied: github-token"
    ),
    "Input required and not supplied: github-token"
  );
});

test("errors when neither Slack or Webex is configured", async (t) => {
  setMockEnv({
    "webex-token": "",
    "slack-token": "",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit();
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(
    core.setFailed.calledWithMatch(
      "You must provide either a <slack-token> or <webex-token>. Please see the README for more information."
    ),
    "Input required and not supplied: slack-token"
  );
});

test("errors when Slack token is passed without destination", async (t) => {
  setMockEnv({
    "slack-destination": ""
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit();
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(
    core.setFailed.calledWithMatch(
      "You must provide a <slack-destination> when forwarding notifications to Slack. Please see the README for more information."
    ),
    "Input required and not supplied: slack-token"
  );
});

test("errors when Webex token is passed without email", async (t) => {
  setMockEnv({
    "webex-email": "",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit();
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(
    core.setFailed.calledWithMatch(
      "You must provide a <webex-email> when forwarding notifications to Webex. Please see the README for more information."
    ),
    "Input required and not supplied: slack-token"
  );
});

test("errors on invalid action-schedule", async (t) => {
  setMockEnv({
    "action-schedule": "a b c",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit();
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(core.setFailed.calledWithMatch("Invalid <action-schedule>"), "Invalid <action-schedule>");
});

test("errors when invalid filter reason is set", async (t) => {
  setMockEnv({
    "filter-include-reasons": "<all the things I want to hear>",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit();
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(core.setFailed.calledWithMatch("Invalid reason in filter input."), "Invalid reason in filter input.");
});

test("errors when invalid filter repository is set", async (t) => {
  setMockEnv({
    "filter-include-repositories": "not-a-full-name",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit();
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(core.setFailed.calledWithMatch("Invalid repository in filter input."), "Invalid repository in filter input.");
});

test("exits when no new notifications", async (t) => {
  setMockEnv({});
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();

  t.true(core.setFailed.notCalled);
  t.true(core.info.calledWithMatch("No new notifications fetched since last run"), "No new notifications fetched since last run");
});

test("determines the previous interval correctly", async (t) => {
  // Action will often run ~5 minutes after hour
  MockDate.set("2022-01-30T08:05:00.000Z");
  setMockEnv({
    "action-schedule": "0 * * * *",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();

  t.true(core.setFailed.notCalled);
  // Should be the hour before trigger, so 7am instead of 8am
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.getCall(0).args[0].since, "2022-01-30T07:00:00.000Z")

  // But if we call at 7:59am, the previous interval should be 6am
  MockDate.set("2022-01-30T07:59:00.000Z");
  setMockEnv({
    "action-schedule": "0 * * * *",
  });
  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 2);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.getCall(1).args[0].since, "2022-01-30T06:00:00.000Z")
});

test("sends slack message of notifications using defaults", async (t) => {
  setMockEnv({});
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([
    createMockNotification("<A notification>", "github/github", REASONS.ASSIGN)
  ]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();
  const slack = getSlack();

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 1);
  t.false(octokit.rest.activity.listNotificationsForAuthenticatedUser.getCall(0).args[0].all);
  t.false(octokit.rest.activity.listNotificationsForAuthenticatedUser.getCall(0).args[0].participating);
  t.is(slack.chat.postMessage.callCount, 1);
  t.true(slack.chat.postMessage.getCall(0).args[0].text.includes("<A notification>"));

  // Valid `html_url` fetched via octokit.request()
  t.true(slack.chat.postMessage.getCall(0).args[0].text.includes(`<<subject url for - "<A notification>"> html_url>`));
});

test("sends webex message of notifications using defaults", async (t) => {
  setMockEnv({});
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([
    createMockNotification("<A notification>", "github/github", REASONS.ASSIGN)
  ]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();
  const webex = getWebex();

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 1);
  t.false(octokit.rest.activity.listNotificationsForAuthenticatedUser.getCall(0).args[0].all);
  t.false(octokit.rest.activity.listNotificationsForAuthenticatedUser.getCall(0).args[0].participating);
  t.is(webex.messages.create.callCount, 1);

  t.true(webex.messages.create.getCall(0).args[0].markdown.includes(`[<A notification>](<<subject url for - "<A notification>"> html_url>)`))
});

test("marks sent notifications as read when mark-as-read is true", async (t) => {
  setMockEnv({
    "mark-as-read": "true",
    // Don't reverse order to make testing easier
    "sort-oldest-first": "false",
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([
    createMockNotification("<Notification 1>", "github/github", REASONS.ASSIGN),
    createMockNotification("<Notification 2>", "github/howie", REASONS.PUSH)
  ]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();
  const slack = getSlack();

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 1);
  t.is(slack.chat.postMessage.callCount, 1);
  t.is(octokit.rest.activity.markThreadAsRead.callCount, 2);
  t.true(octokit.rest.activity.markThreadAsRead.getCall(0).args[0].thread_id.includes("<Notification 1>"));
  t.true(octokit.rest.activity.markThreadAsRead.getCall(1).args[0].thread_id.includes("<Notification 2>"));
});

test("filters on filter-include-reasons", async (t) => {
  setMockEnv({
    "filter-include-reasons": `${REASONS.ASSIGN}, ${REASONS.PUSH}, ${REASONS.AUTHOR}`
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([
    // Included
    createMockNotification("<Notification 1>", "github/github", REASONS.ASSIGN),
    createMockNotification("<Notification 2>", "github/github", REASONS.PUSH),
    createMockNotification("<Notification 3>", "github/github", REASONS.PUSH),
    createMockNotification("<Notification 4>", "github/github", REASONS.AUTHOR),
    // Excluded
    createMockNotification("<Notification 5>", "github/github", REASONS.CI_ACTIVITY),
    createMockNotification("<Notification 6>", "github/github", REASONS.CI_ACTIVITY),
    createMockNotification("<Notification 7>", "github/github", REASONS.TEAM_MENTION),
  ]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();
  const slack = getSlack();

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 1);
  t.is(slack.chat.postMessage.callCount, 1);
  const messageBody = slack.chat.postMessage.getCall(0).args[0].text;
  t.true(messageBody.includes("<Notification 1>"));
  t.true(messageBody.includes("<Notification 2>"));
  t.true(messageBody.includes("<Notification 3>"));
  t.true(messageBody.includes("<Notification 4>"));
  t.false(messageBody.includes("<Notification 5>"));
  t.false(messageBody.includes("<Notification 6>"));
  t.false(messageBody.includes("<Notification 7>"));
});


test("filters on filter-exclude-reasons", async (t) => {
  setMockEnv({
    "filter-exclude-reasons": `${REASONS.CI_ACTIVITY}, ${REASONS.TEAM_MENTION}`
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([
    // Included
    createMockNotification("<Notification 1>", "github/github", REASONS.ASSIGN),
    createMockNotification("<Notification 2>", "github/github", REASONS.PUSH),
    createMockNotification("<Notification 3>", "github/github", REASONS.PUSH),
    createMockNotification("<Notification 4>", "github/github", REASONS.AUTHOR),
    // Excluded
    createMockNotification("<Notification 5>", "github/github", REASONS.CI_ACTIVITY),
    createMockNotification("<Notification 6>", "github/github", REASONS.CI_ACTIVITY),
    createMockNotification("<Notification 7>", "github/github", REASONS.TEAM_MENTION),
  ]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();
  const slack = getSlack();

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 1);
  t.is(slack.chat.postMessage.callCount, 1);
  const messageBody = slack.chat.postMessage.getCall(0).args[0].text;
  t.true(messageBody.includes("<Notification 1>"));
  t.true(messageBody.includes("<Notification 2>"));
  t.true(messageBody.includes("<Notification 3>"));
  t.true(messageBody.includes("<Notification 4>"));
  t.false(messageBody.includes("<Notification 5>"));
  t.false(messageBody.includes("<Notification 6>"));
  t.false(messageBody.includes("<Notification 7>"));
});

test("filters on filter-include-repositories", async (t) => {
  setMockEnv({
    "filter-include-repositories": `github/docs, ebonsignori/github-slack-notifications-forwarder`,
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([
    // Included
    createMockNotification("<Notification 1>", "github/docs", REASONS.PUSH),
    createMockNotification("<Notification 2>", "github/docs", REASONS.AUTHOR),
    createMockNotification("<Notification 3>", "ebonsignori/github-slack-notifications-forwarder", REASONS.AUTHOR),
    // Excluded
    createMockNotification("<Notification 4>", "github/github", REASONS.ASSIGN),
    createMockNotification("<Notification 5>", "github/howie", REASONS.PUSH),
  ]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();
  const slack = getSlack();

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 1);
  t.is(slack.chat.postMessage.callCount, 1);
  const messageBody = slack.chat.postMessage.getCall(0).args[0].text;
  t.true(messageBody.includes("<Notification 1>"));
  t.true(messageBody.includes("<Notification 2>"));
  t.true(messageBody.includes("<Notification 3>"));
  t.false(messageBody.includes("<Notification 4>"));
  t.false(messageBody.includes("<Notification 5>"));
});

test("filters on filter-exclude-repositories", async (t) => {
  setMockEnv({
    "filter-exclude-repositories": `github/docs, ebonsignori/github-slack-notifications-forwarder`,
  });
  const getCore = mockGetCore();
  const getOctokit = mockGetOctokit([
    // Excluded
    createMockNotification("<Notification 1>", "github/docs", REASONS.PUSH),
    createMockNotification("<Notification 2>", "github/docs", REASONS.AUTHOR),
    createMockNotification("<Notification 3>", "ebonsignori/github-slack-notifications-forwarder", REASONS.AUTHOR),
    // Included
    createMockNotification("<Notification 4>", "github/github", REASONS.ASSIGN),
    createMockNotification("<Notification 5>", "github/howie", REASONS.PUSH),
  ]);
  const getSlack = mockGetSlack();
  const getWebex = mockGetWebex();

  await run(getCore as any, getOctokit as any, getSlack as any, getWebex as any);

  const core = getCore();
  const octokit = getOctokit();
  const slack = getSlack();

  t.true(core.setFailed.notCalled);
  t.is(octokit.rest.activity.listNotificationsForAuthenticatedUser.callCount, 1);
  t.is(slack.chat.postMessage.callCount, 1);
  const messageBody = slack.chat.postMessage.getCall(0).args[0].text;
  t.false(messageBody.includes("<Notification 1>"));
  t.false(messageBody.includes("<Notification 2>"));
  t.false(messageBody.includes("<Notification 3>"));
  t.true(messageBody.includes("<Notification 4>"));
  t.true(messageBody.includes("<Notification 5>"));
});

// TODO: Test rollup-notifications
// TODO: Test timezone and date-format
// TODO: Test determined html URLs
