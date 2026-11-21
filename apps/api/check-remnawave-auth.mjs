
import "dotenv/config";

const apiKey = process.env.jetsale.online_TINYAUTH_X_API_KEY;

const url = new URL(
  "/api/internal-squads/b73684c7-ce2e-4c3f-9065-fb940578214b/accessible-nodes",
  process.env.REMWAVE_BASE_URL
);

const response = await fetch(url, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.REMWAVE_API_TOKEN}`,
    "X-Api-Key": apiKey,
  },
  redirect: "manual",
});

const location = response.headers.get("location");

console.log({
  status: response.status,
  contentType: response.headers.get("content-type"),
  redirect: location
    ? new URL(location, url).origin + new URL(location, url).pathname
    : null,
});
