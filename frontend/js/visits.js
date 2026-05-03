// visits.js

// 🔹 MOCK DATA (replace with API later)
const visits = [
  {
    id: 1,
    client_name: "Rahul Sharma",
    property: "2BHK Baner",
    time: "Today 4:00 PM",
    status: "scheduled"
  },
  {
    id: 2,
    client_name: "Priya Patil",
    property: "3BHK Hinjewadi",
    time: "Tomorrow 11:00 AM",
    status: "confirmed"
  }
];


// 🔹 Render all visits
function renderVisits() {
  const container = document.querySelector(".dashboard");
  container.innerHTML = "";

  visits.forEach(visit => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h3>${visit.client_name}</h3>
      <div class="meta">Property: ${visit.property}</div>
      <div class="meta">Time: ${visit.time}</div>

      <span class="status ${visit.status}">
        ${formatStatus(visit.status)}
      </span>

      <div class="actions">
        <button class="start" onclick="startVisit(${visit.id})">Start</button>
        <button class="reschedule" onclick="rescheduleVisit(${visit.id})">Reschedule</button>
        <button class="cancel" onclick="cancelVisit(${visit.id})">Cancel</button>
      </div>
    `;

    container.appendChild(card);
  });
}


// 🔹 Format status text
function formatStatus(status) {
  return status
    .replace("_", " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}


// 🔹 Start Visit
function startVisit(id) {
  const visit = visits.find(v => v.id === id);
  if (!visit) return;

  visit.status = "inprogress";
  renderVisits();

  console.log("Visit started:", id);
}


// 🔹 Cancel Visit
function cancelVisit(id) {
  const visit = visits.find(v => v.id === id);
  if (!visit) return;

  visit.status = "noshow";
  renderVisits();

  console.log("Visit cancelled:", id);
}


// 🔹 Reschedule Visit (basic version)
function rescheduleVisit(id) {
  const newTime = prompt("Enter new time:");
  if (!newTime) return;

  const visit = visits.find(v => v.id === id);
  visit.time = newTime;
  visit.status = "scheduled";

  renderVisits();

  console.log("Rescheduled:", id);
}


// 🔹 Init
document.addEventListener("DOMContentLoaded", () => {
  renderVisits();
});
