import "dotenv/config";

const url = process.env.PROXY_MANAGER_URL;
const token = process.env.PROXY_MANAGER_TOKEN;

if (!url || !token) {
  throw new Error("Proxy Manager env is missing");
}

const response = await fetch(`${url}/v1/users`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});

console.log("HTTP STATUS:", response.status);
