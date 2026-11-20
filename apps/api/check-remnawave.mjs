import "dotenv/config";

const u = new URL(
  "/api/internal-squads/b73684c7-ce2e-4c3f-9065-fb940578214b/accessible-nodes",
  process.env.REMWAVE_BASE_URL
);

const r = await fetch(u, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.REMWAVE_API_TOKEN}`,
  },
  redirect: "manual",
});

const loc = r.headers.get("location");

console.log({
  status: r.status,
  contentType: r.headers.get("content-type"),
  redirect: loc ? new URL(loc, u).origin + new URL(loc, u).pathname : null,
});
