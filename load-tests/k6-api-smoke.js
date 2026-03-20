import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = __ENV.AUTH_COOKIE || "";

export const options = {
  scenarios: {
    ramp_to_10k: {
      executor: "ramping-vus",
      stages: [
        { duration: "2m", target: 1000 },
        { duration: "4m", target: 5000 },
        { duration: "4m", target: 10000 },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1200"],
  },
};

function authHeaders() {
  if (!AUTH_COOKIE) {
    return { "Content-Type": "application/json" };
  }

  return {
    "Content-Type": "application/json",
    Cookie: AUTH_COOKIE,
  };
}

export default function () {
  const profileRes = http.get(`${BASE_URL}/api/user/profile`, {
    headers: authHeaders(),
    timeout: "10s",
  });

  check(profileRes, {
    "profile status is 200 or 401": (r) => r.status === 200 || r.status === 401,
  });

  const historyRes = http.get(`${BASE_URL}/api/predictions/history?limit=20`, {
    headers: authHeaders(),
    timeout: "10s",
  });

  check(historyRes, {
    "history status is 200 or 401": (r) => r.status === 200 || r.status === 401,
  });

  const payload = JSON.stringify({
    age: 42,
    sex: 1,
    chest_pain_type: 2,
    resting_bp: 122,
    cholesterol: 215,
    fasting_blood_sugar: 0,
    resting_ecg: 1,
    max_heart_rate: 150,
    exercise_angina: 0,
    oldpeak: 1.1,
    st_slope: 2,
  });

  const heartRes = http.post(`${BASE_URL}/api/heart-disease`, payload, {
    headers: authHeaders(),
    timeout: "15s",
  });

  check(heartRes, {
    "heart endpoint healthy": (r) => [200, 401, 429].includes(r.status),
  });

  sleep(1);
}
