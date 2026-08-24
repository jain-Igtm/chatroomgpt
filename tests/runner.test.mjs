import assert from "node:assert/strict";
import test from "node:test";

import {
  MutationQueue,
  formatAgentComment,
  nextRoundNumber,
  parseBoolean,
  parseEnvelope,
  readSseData,
  resolveControlState,
  shouldAutoHandoff,
  stripEnvelope,
} from "../scripts/run-room.mjs";

test("message envelopes round-trip", () => {
  const body = formatAgentComment({
    agent: { id: "lantern", name: "Lantern", accent: "#73d6c7" },
    model: "gpt-5.6",
    round: 3,
    runId: "run-1",
    state: "complete",
    text: "The compass moved.",
  });

  assert.equal(parseEnvelope(body).agent, "Lantern");
  assert.equal(parseEnvelope(body).round, 3);
  assert.equal(stripEnvelope(body), "The compass moved.");
});

test("only trusted, current controls affect a run", () => {
  const comments = [
    {
      body: "/stop",
      created_at: "2026-08-24T08:00:00Z",
      author_association: "OWNER",
    },
    {
      body: "/pause",
      created_at: "2026-08-24T09:01:00Z",
      author_association: "NONE",
    },
    {
      body: "/pause",
      created_at: "2026-08-24T09:02:00Z",
      author_association: "OWNER",
    },
    {
      body: "/resume",
      created_at: "2026-08-24T09:03:00Z",
      author_association: "COLLABORATOR",
    },
  ];

  assert.equal(resolveControlState(comments, "2026-08-24T09:00:00Z"), "running");
});

test("SSE reader handles split chunks and multiple events", async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"response.output_'));
      controller.enqueue(
        encoder.encode('text.delta","delta":"hi"}\n\ndata: [DONE]\n\n'),
      );
      controller.close();
    },
  });

  const events = [];
  for await (const data of readSseData(stream)) events.push(data);
  assert.deepEqual(events, [
    '{"type":"response.output_text.delta","delta":"hi"}',
    "[DONE]",
  ]);
});

test("mutation queue never overlaps writes", async () => {
  const queue = new MutationQueue(1);
  let active = 0;
  let maximumActive = 0;
  const order = [];

  await Promise.all(
    [1, 2, 3].map((number) =>
      queue.enqueue(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 4));
        order.push(number);
        active -= 1;
      }),
    ),
  );

  assert.equal(maximumActive, 1);
  assert.deepEqual(order, [1, 2, 3]);
});

test("boolean workflow inputs are parsed without truthy string mistakes", () => {
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("false", true), false);
  assert.equal(parseBoolean("0", true), false);
  assert.equal(parseBoolean("unexpected", true), true);
});

test("automatic handoff only follows an infinite session reaching its limit", () => {
  assert.equal(
    shouldAutoHandoff({ enabled: true, rounds: 0, exitReason: "runtime-limit" }),
    true,
  );
  assert.equal(
    shouldAutoHandoff({ enabled: true, rounds: 8, exitReason: "runtime-limit" }),
    false,
  );
  assert.equal(
    shouldAutoHandoff({ enabled: true, rounds: 0, exitReason: "stopped" }),
    false,
  );
  assert.equal(
    shouldAutoHandoff({ enabled: false, rounds: 0, exitReason: "runtime-limit" }),
    false,
  );
});

test("a successor continues global round numbering", () => {
  const comments = [
    { body: "human message" },
    {
      body: '<!-- chatroomgpt:message {"round":17,"state":"complete"} -->\n### Nacre\n\nHello',
    },
    {
      body: '<!-- chatroomgpt:message {"round":18,"state":"error"} -->\n### Kestrel\n\nLost',
    },
  ];

  assert.equal(nextRoundNumber(comments), 19);
});
