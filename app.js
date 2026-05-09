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
const auth = firebase.auth();


// =====================
// 🔹 Variables
// =====================
let userName, room;
let typingTimeout;
let isCreator = false;
let isLoginMode = true;


// =====================
// 🔹 Helper Functions
// =====================
function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if ((password.match(/[a-zA-Z]/g) || []).length < 2) return "Password must contain at least 2 letters.";
  if ((password.match(/[0-9]/g) || []).length < 2) return "Password must contain at least 2 numbers.";
  if ((password.match(/[^a-zA-Z0-9]/g) || []).length < 2) return "Password must contain at least 2 special characters (e.g., @, #, $, &).";
  return null;
}

function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, function(url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

// =====================
// 🔹 Authentication
// =====================
function toggleTheme() {
  document.body.classList.toggle("light-mode");
}

function openModal(id) {
  document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

window.addEventListener("scroll", () => {
  let header = document.getElementById("main-header");
  if (header) {
    if (window.scrollY > 0) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
});

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    document.getElementById("auth-title").innerText = "Login to Chat";
    document.getElementById("auth-btn").innerText = "Login";
    document.getElementById("auth-toggle").innerText = "Don't have an account? Sign Up";
    document.getElementById("auth-name").style.display = "none";
    document.getElementById("auth-confirm-password").style.display = "none";
    document.getElementById("auth-password").placeholder = "Password";
  } else {
    document.getElementById("auth-title").innerText = "Create Account";
    document.getElementById("auth-btn").innerText = "Sign Up";
    document.getElementById("auth-toggle").innerText = "Already have an account? Login";
    document.getElementById("auth-name").style.display = "block";
    document.getElementById("auth-confirm-password").style.display = "block";
    document.getElementById("auth-password").placeholder = "Create a Password";
  }
}

function togglePasswordVisibility() {
  let passField = document.getElementById("auth-password");
  let confirmPassField = document.getElementById("auth-confirm-password");
  let isChecked = document.getElementById("show-password").checked;
  
  passField.type = isChecked ? "text" : "password";
  confirmPassField.type = isChecked ? "text" : "password";
}

function toggleCreatePasswordVisibility() {
  let passField = document.getElementById("create-password");
  let isChecked = document.getElementById("show-create-password").checked;
  passField.type = isChecked ? "text" : "password";
}

function toggleJoinPasswordVisibility() {
  let passField = document.getElementById("join-password");
  let isChecked = document.getElementById("show-join-password").checked;
  passField.type = isChecked ? "text" : "password";
}

function handleAuth() {
  let email = document.getElementById("auth-email").value.trim();
  let password = document.getElementById("auth-password").value.trim();
  let confirmPassword = document.getElementById("auth-confirm-password").value.trim();
  let name = document.getElementById("auth-name").value.trim();

  if (!email || !password) {
    alert("Email and password are required!");
    return;
  }

  if (isLoginMode) {
    auth.signInWithEmailAndPassword(email, password)
      .catch(error => alert("Login Error: " + error.message));
  } else {
    if (!name) {
      alert("Please enter your full name!");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    // Password strong format check
    let passError = validatePassword(password);
    if (passError) {
      alert(passError);
      return;
    }

    auth.createUserWithEmailAndPassword(email, password)
      .then(userCredential => {
        return userCredential.user.updateProfile({ displayName: name });
      })
      .catch(error => alert("Sign Up Error: " + error.message));
  }
}

function logout() {
  auth.signOut();
}

// 🔹 Auth State Observer
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("join").style.display = "flex";
    
    let displayName = user.displayName || document.getElementById("auth-name").value.trim() || user.email.split('@')[0];
    document.getElementById("name").value = displayName;
    loadRooms();
  } else {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("join").style.display = "none";
    document.getElementById("chat").style.display = "none";
    db.ref("rooms").off("value");
    
    document.getElementById("auth-email").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-confirm-password").value = "";
    document.getElementById("auth-name").value = "";
    document.getElementById("show-password").checked = false;
    togglePasswordVisibility();
    document.getElementById("show-create-password").checked = false;
    toggleCreatePasswordVisibility();
    document.getElementById("show-join-password").checked = false;
    toggleJoinPasswordVisibility();
    closeModal("create-modal");
    closeModal("join-modal");
  }
});


// =====================
// 🔹 Load Available Rooms
// =====================
function loadRooms() {
  db.ref("rooms").off("value");
  db.ref("rooms").on("value", snap => {
    let roomList = document.getElementById("room-list");
    if (!roomList) return;
    
    roomList.innerHTML = "";
    let data = snap.val();
    
    if (!data) {
      roomList.innerHTML = "<p style='color:#94a3b8; font-size:13px; margin:0;'>No active rooms right now.</p>";
      return;
    }

    let hasRooms = false;
    for (let roomKey in data) {
      let r = data[roomKey];
      if (!r.password) continue; 
      
      hasRooms = true;
      let usersCount = r.users ? Object.keys(r.users).length : 0;
      let max = r.maxLimit || "-";
      
      let div = document.createElement("div");
      div.className = "room-item";
      
      div.innerHTML = `
        <div class="room-info">
          <span class="room-name">${roomKey}</span>
          <span class="room-meta">Creator: ${r.creator || 'Unknown'} • Users: ${usersCount}/${max}</span>
        </div>
        <button class="join-btn" style="padding: 6px 12px; font-size: 12px;" onclick="selectRoom('${roomKey}')">Join</button>
      `;
      roomList.appendChild(div);
    }

    if (!hasRooms) {
      roomList.innerHTML = "<p style='color:#94a3b8; font-size:13px; margin:0;'>No active rooms right now.</p>";
    }
  });
}

function selectRoom(roomCode) {
  document.getElementById("join-room").value = roomCode;
  openModal("join-modal");
  document.getElementById("join-password").focus();
}


// =====================
// 🔹 Create Room
// =====================
function createRoom() {
  userName = document.getElementById("name").value.trim();
  room = document.getElementById("create-room").value.trim();
  let password = document.getElementById("create-password").value.trim();
  let maxLimit = parseInt(document.getElementById("create-max").value.trim());

  if (!userName || !room || !password || !maxLimit) {
    alert("Please fill all fields to create a room.");
    return;
  }

  // Room password strong format check
  let passError = validatePassword(password);
  if (passError) {
    alert("Room " + passError.toLowerCase());
    return;
  }

  db.ref("rooms/" + room).once("value").then((snap) => {
    if (snap.exists()) {
      alert("Room already exists! Please join it or choose a different name.");
      return;
    }

    // Create new room with creator info and max limit
    db.ref("rooms/" + room).set({
      password: password,
      maxLimit: maxLimit,
      creator: userName,
      users: { [userName]: true }
    }).then(() => {
      isCreator = true;
      enterChat();
    });
  });
}


// =====================
// 🔹 Join Room
// =====================
function joinRoom() {
  userName = document.getElementById("name").value.trim();
  room = document.getElementById("join-room").value.trim();
  let password = document.getElementById("join-password").value.trim();

  if (!userName || !room || !password) {
    alert("Please fill all fields to join a room.");
    return;
  }

  db.ref("rooms/" + room).once("value").then((snap) => {
    if (!snap.exists()) {
      alert("Room does not exist!");
      return;
    }

    let data = snap.val();

    if (data.password !== password) {
      alert("Incorrect password!");
      return;
    }

    let currentUsersCount = data.users ? Object.keys(data.users).length : 0;
    if (currentUsersCount >= data.maxLimit) {
      alert("Room is full! Maximum capacity reached.");
      return;
    }

    isCreator = (data.creator === userName);

    // Add user to active users list
    db.ref("rooms/" + room + "/users/" + userName).set(true).then(() => {
      enterChat();
    });
  });
}


// =====================
// 🔹 Enter Chat UI Setup
// =====================
function enterChat() {
  document.getElementById("join").style.display = "none";
  document.getElementById("chat").style.display = "flex";
  closeModal("create-modal");
  closeModal("join-modal");
  document.getElementById("roomTitle").innerText = "Room: " + room;

  let box = document.getElementById("messages");
  box.innerHTML = "";

  // Show edit button only for creator
  document.getElementById("editLimitBtn").style.display = isCreator ? "inline-block" : "none";

  // Real-time listener for Max Limit changes
  db.ref("rooms/" + room + "/maxLimit").on("value", snap => {
    if (snap.val()) {
      document.getElementById("limitDisplay").innerText = "Max: " + snap.val();
    }
  });

  // remove old listener
  db.ref("rooms/" + room + "/messages").off();

  // Send join notification
  db.ref("rooms/" + room + "/messages").push({
    type: "system",
    text: userName + " joined the chat",
    time: Date.now()
  });

  // messages listener
  db.ref("rooms/" + room + "/messages").on("child_added", snap => {
    let msg = snap.val();

    if (msg.type === "system") {
      box.innerHTML += `<div class="sys-msg">${msg.text}</div>`;
    } else {
      let side = msg.name === userName ? "right" : "left";
      let time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      box.innerHTML += `
        <div class="msg ${side}">
          <div class="msg-info">
            <span class="name">${msg.name}</span>
            <span class="time">${time}</span>
          </div>
          <p>${linkify(msg.text)}</p>
        </div>
      `;
    }
    box.scrollTop = box.scrollHeight;
  });

  // Typing listener
  db.ref(`rooms/${room}/typing`).on("value", snap => {
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
// 🔹 Edit Max Limit
// =====================
function editMaxLimit() {
  if (!isCreator || !room) return;
  let newLimit = prompt("Enter new maximum join limit:");
  if (newLimit && !isNaN(newLimit) && parseInt(newLimit) > 1) {
    db.ref("rooms/" + room + "/maxLimit").set(parseInt(newLimit));
    alert("Max limit updated successfully!");
  }
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
// 🔹 Leave Function
// =====================
function leave() {
  if (!room || !userName) return;

  // Set typing to false before leaving
  db.ref(`rooms/${room}/typing/${userName}`).set(false);
  
  // Remove user from active users list
  db.ref(`rooms/${room}/users/${userName}`).remove();

  // Send leave notification
  db.ref("rooms/" + room + "/messages").push({
    type: "system",
    text: userName + " left the chat",
    time: Date.now()
  });

  // Remove listeners
  db.ref("rooms/" + room + "/messages").off();
  db.ref("rooms/" + room + "/typing").off();
  db.ref("rooms/" + room + "/maxLimit").off();

  // UI Changes
  document.getElementById("chat").style.display = "none";
  document.getElementById("join").style.display = "flex";
  document.getElementById("messages").innerHTML = "";

  // Clear variables
  room = null;
  userName = null;
  isCreator = false;
  document.getElementById("create-room").value = "";
  document.getElementById("create-password").value = "";
  document.getElementById("create-max").value = "";
  document.getElementById("join-room").value = "";
  document.getElementById("join-password").value = "";
  document.getElementById("show-create-password").checked = false;
  toggleCreatePasswordVisibility();
  document.getElementById("show-join-password").checked = false;
  toggleJoinPasswordVisibility();
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
    db.ref(`rooms/${room}/users/${userName}`).remove();
    db.ref("rooms/" + room + "/messages").push({
      type: "system",
      text: userName + " left the chat",
      time: Date.now()
    });
  }

});