const statusCopy = {
  available: ["发现积分房", "有房"],
  unavailable: ["暂未发现积分房", "暂无"],
  error: ["本次查询未完成", "待重试"],
};

function formatDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function formatTime(value) {
  if (!value) return "尚未查询";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function resultKey(result) {
  return `${result.checkin}_${result.checkout}`;
}

async function load() {
  const status = document.querySelector("#priority-status");
  try {
    const response = await fetch(`data.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("数据读取失败");
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const priorityKeys = new Set(["2026-09-25_2026-09-26", "2026-09-26_2026-09-27"]);
    const priority = results.filter((item) => priorityKeys.has(resultKey(item)));
    const regular = results.filter((item) => !priorityKeys.has(resultKey(item)));
    const available = priority.filter((item) => item.status === "available");
    const priorityStatus = available.length
      ? "available"
      : priority.length === 2 && priority.every((item) => item.status === "unavailable")
        ? "unavailable"
        : "error";
    const points = available.map((item) => item.points).filter(Number.isFinite).sort((a, b) => a - b)[0];
    const detail = priorityStatus === "available"
      ? `${available.map((item) => `${formatDate(item.checkin)}入住`).join("、")}可兑换${points ? `，最低约 ${points.toLocaleString("zh-CN")} 积分` : ""}`
      : priorityStatus === "unavailable"
        ? "两个单晚都暂未发现积分房"
        : "部分日期查询未完成，将在下次自动重试";

    status.className = `status ${priorityStatus}`;
    status.innerHTML = `<span class="status-icon" aria-hidden="true">${priorityStatus === "available" ? "✓" : priorityStatus === "unavailable" ? "⌕" : "!"}</span><div><strong>${statusCopy[priorityStatus][0]}</strong><p>${detail}</p></div>`;
    document.querySelector("#priority-options").innerHTML = priority.map((item) => `<a href="${item.bookingUrl}" target="_blank" rel="noreferrer"><span>${formatDate(item.checkin)}入住</span><strong>${statusCopy[item.status][1]}${item.points ? ` · ${item.points.toLocaleString("zh-CN")}分` : ""}</strong></a>`).join("");
    document.querySelector("#updated-at").textContent = `更新于 ${formatTime(data.fetchedAt)}`;
    document.querySelector("#date-count").textContent = regular.length;
    const availableCount = regular.filter((item) => item.status === "available").length;
    const summary = document.querySelector("#result-summary");
    summary.hidden = false;
    summary.textContent = availableCount ? `发现 ${availableCount} 个可兑换日期` : "本轮暂未发现其他积分房";
    document.querySelector("#date-grid").innerHTML = regular.map((item) => `<article class="date-card ${item.status}"><div><p>${formatDate(item.checkin)}</p><small>${item.label}</small></div><a href="${item.bookingUrl}" target="_blank" rel="noreferrer">${statusCopy[item.status][1]}${item.points ? `<br>${item.points.toLocaleString("zh-CN")}分` : ""}</a></article>`).join("");
  } catch {
    status.className = "status error";
    status.innerHTML = '<span class="status-icon" aria-hidden="true">!</span><div><strong>暂时无法读取结果</strong><p>请稍后刷新页面</p></div>';
  }
}

document.querySelector("#toggle-dates").addEventListener("click", (event) => {
  const grid = document.querySelector("#date-grid");
  grid.hidden = !grid.hidden;
  event.currentTarget.textContent = grid.hidden ? "查看全部日期" : "收起全部日期";
});

load();
