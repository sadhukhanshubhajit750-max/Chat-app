// =====================
// 🔹 Firebase config
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBHl1rDGlL6N1SeaNzyiW_Mfn6J2_g0_78",
  authDomain: "chat-app-c219.firebaseapp.com",
  databaseURL: "https://chat-app-c219-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-c219",
  storageBucket: "chat-app-c219.firebasestorage.app",
  messagingSenderId: "758401611846",
  appId: "1:758401611846:web:17dd58f2e889e8be7cf247",
  measurementId: "G-D765TG1HPB"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();


// =====================
// 🔹 Variables
// =====================
let userName, room;
let typingTimeout;


// =====================
// 🔹 Join Function
// =====================
function join() {

  userName = document.getElementById("name").value.trim();
  room = document.getElementById("room").value.trim();

  if (!userName || !room) {
    alert("Name and room required");
    return;
  }

  // UI change
  document.getElementById("join").style.display = "none";
  document.getElementById("chat").style.display = "flex";
  document.getElementById("roomTitle").innerText = "Room: " + room;

  let box = document.getElementById("messages");
  box.innerHTML = "";

  // remove old listener
  db.ref("rooms/" + room + "/messages").off();

  // messages listener
  db.ref("rooms/" + room + "/messages")
    .on("child_added", snap => {

      let msg = snap.val();

      let side = msg.name === userName ? "right" : "left";
      let time = new Date(msg.time).toLocaleTimeString();

      box.innerHTML += `
        <div class="msg ${side}">
          <span class="name">${msg.name} • ${time}</span>
          <p>${msg.text}</p>
        </div>
      `;

      box.scrollTop = box.scrollHeight;
    });

  // =====================
  // 🔹 Typing Listener (safe inside join)
  // =====================
  db.ref(`rooms/${room}/typing`)
    .on("value", snap => {

      let data = snap.val() || {};

      let typingUsers = Object.keys(data).filter(name => data[name] && name !== userName);

      let boxTyping = document.getElementById("typing");

      if (!boxTyping) return;

      if (typingUsers.length > 0) {
        boxTyping.innerText = "Someone is typing...";
        boxTyping.style.display = "block";
      } else {
        boxTyping.style.display = "none";
      }

    });
}


// =====================
// 🔹 Send Message
// =====================
function send() {

  let text = document.getElementById("msg").value.trim();

  if (!text || !room) return;

  db.ref("rooms/" + room + "/messages").push({
    name: userName,
    text: text,
    time: Date.now()
  });

  document.getElementById("msg").value = "";

  // typing OFF after send
  db.ref(`rooms/${room}/typing/${userName}`).set(false);
}


// =====================
// 🔹 Typing Detect (SAFE) & Enter to send
// =====================
window.addEventListener("load", () => {

  const input = document.getElementById("msg");

  if (!input) return;

  input.addEventListener("input", () => {

    if (!room) return;

    db.ref(`rooms/${room}/typing/${userName}`).set(true);

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
      db.ref(`rooms/${room}/typing/${userName}`).set(false);
    }, 1000);

  });

  // "Enter" চাপলে মেসেজ সেন্ড হবে
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });

});


// =====================
// 🔹 Cleanup on close
// =====================
window.addEventListener("beforeunload", () => {

  if (room && userName) {
    db.ref(`rooms/${room}/typing/${userName}`).set(false);
  }

});