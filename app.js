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
const storage = firebase.storage();


// =====================
// 🔹 Variables
// =====================
let userName, room;
let typingTimeout;
let isCreator = false;
let isLoginMode = true;
let chatMessages = {};
let replyingTo = null;
let swipeStartX = 0;
let swipeStartY = 0;
let activeSwipeKey = null;
let isLeaving = false;
let holdTimeout;
let isHolding = false;
let activeMsgKey = null;
let holdX = 0;
let holdY = 0;


// =====================
// 🔹 Helper Functions
// =====================
function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  return null;
}

function linkify(text) {
  if (!text) return "";
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
    localStorage.removeItem("savedRooms");
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

    let currentUser = document.getElementById("name").value.trim();
    let roomsArray = [];

    for (let roomKey in data) {
      let r = data[roomKey];
      if (!r.password) continue; 
      
      let lastActivity = 0;
      if (r.messages) {
        let msgKeys = Object.keys(r.messages);
        if (msgKeys.length > 0) {
          // ফায়ারবেসের সর্বশেষ মেসেজটির টাইম বের করা
          let lastMsgKey = msgKeys[msgKeys.length - 1];
          lastActivity = r.messages[lastMsgKey].time || 0;
        }
      }
      
      roomsArray.push({ key: roomKey, data: r, lastActivity: lastActivity });
    }

    if (roomsArray.length === 0) {
      roomList.innerHTML = "<p style='color:#94a3b8; font-size:13px; margin:0;'>No active rooms right now.</p>";
      return;
    }

    // সর্বশেষ অ্যাক্টিভিটি (মেসেজ) অনুযায়ী রুমগুলোকে সর্ট (Sort) করা হচ্ছে
    roomsArray.sort((a, b) => b.lastActivity - a.lastActivity);

    roomsArray.forEach(roomObj => {
      let roomKey = roomObj.key;
      let r = roomObj.data;
      let usersCount = r.users ? Object.keys(r.users).length : 0;
      let max = r.maxLimit || "-";
      let creatorText = (r.creator === currentUser) ? "MADE BY you" : `Creator: ${r.creator || 'Unknown'}`;
      
      let div = document.createElement("div");
      div.className = "room-item";
      
      div.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:42px; height:42px; border-radius:50%; background: linear-gradient(135deg, #3f3f46, #000000); display:flex; justify-content:center; align-items:center; font-weight:700; font-size:18px; color:#fff; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);">
            ${roomKey.charAt(0).toUpperCase()}
          </div>
          <div class="room-info">
            <span class="room-name">${roomKey}</span>
            <span class="room-meta">${creatorText} • Users: ${usersCount}/${max}</span>
          </div>
        </div>
        <button class="join-btn" style="padding: 8px 16px; font-size: 13px; border-radius:20px; box-shadow:none;" onclick="selectRoom('${roomKey}')">Join</button>
      `;
      roomList.appendChild(div);
    });
  });
}

function selectRoom(roomCode) {
  document.getElementById("join-room").value = roomCode;
  let savedRooms = JSON.parse(localStorage.getItem("savedRooms") || "{}");
  if (savedRooms[roomCode]) {
    joinRoom(); // Auto-join directly
  } else {
    openModal("join-modal");
    document.getElementById("join-password").focus();
  }
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
      users: { [userName]: true },
      allUsers: { [userName]: "active" }
    }).then(() => {
      isCreator = true;
      let savedRooms = JSON.parse(localStorage.getItem("savedRooms") || "{}");
      savedRooms[room] = password;
      localStorage.setItem("savedRooms", JSON.stringify(savedRooms));
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

  let savedRooms = JSON.parse(localStorage.getItem("savedRooms") || "{}");
  if (!password && savedRooms[room]) {
    password = savedRooms[room];
  }

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
      if (savedRooms[room]) {
        delete savedRooms[room];
        localStorage.setItem("savedRooms", JSON.stringify(savedRooms));
      }
      openModal("join-modal");
      document.getElementById("join-password").focus();
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
      db.ref("rooms/" + room + "/allUsers/" + userName).set("active");
      savedRooms[room] = password;
      localStorage.setItem("savedRooms", JSON.stringify(savedRooms));
      enterChat();
    });
  });
}


// =====================
// 🔹 Enter Chat UI Setup
// =====================
function enterChat() {
  isLeaving = false;
  document.getElementById("join").style.display = "none";
  document.getElementById("chat").style.display = "flex";
  closeModal("create-modal");
  closeModal("join-modal");
  document.getElementById("roomTitle").innerText = "Room: " + room;
  
  chatMessages = {}; // Reset local messages store
  cancelReply(); // Reset reply state

  let box = document.getElementById("messages");
  box.innerHTML = "";

  // Show edit button only for creator
  let editBtn = document.getElementById("editLimitBtn");
  if (editBtn) {
    editBtn.style.display = isCreator ? "inline-block" : "none";
  }

  // Real-time listener for Max Limit changes
  db.ref("rooms/" + room + "/maxLimit").on("value", snap => {
    if (snap.val()) {
      let limitDisp = document.getElementById("limitDisplay");
      if (limitDisp) limitDisp.innerText = "Max: " + snap.val();
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
    let msgKey = snap.key;
    chatMessages[msgKey] = msg;

    if (msg.type === "system") {
      box.innerHTML += `<div id="msg-${msgKey}" class="sys-msg">${msg.text}</div>`;
    } else {
      if (msg.name !== userName && msg.status !== "read") {
        db.ref("rooms/" + room + "/messages/" + msgKey).update({ status: "read" });
      }

      let side = msg.name === userName ? "right" : "left";
      let time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let readClass = msg.status === "read" ? "read" : "";
      let ticks = msg.name === userName ? `<span id="tick-${msgKey}" class="ticks ${readClass}"><svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg></span>` : "";
      
      let replyHTML = '';
      if (msg.replyTo) {
        let rName = msg.replyTo.name === userName ? "You" : msg.replyTo.name;
        let rText = msg.replyTo.imageUrl ? "📷 Image" : msg.replyTo.text;
        replyHTML = `
          <div class="replied-msg-box" onclick="document.getElementById('msg-${msg.replyTo.key}').scrollIntoView({behavior: 'smooth', block: 'center'})">
            <div style="font-weight: 600; color: #00a884; font-size: 11px; margin-bottom: 3px;">${rName}</div>
            <div style="font-size: 12px; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${rText}</div>
          </div>
        `;
      }

      let editedMark = msg.edited ? '<span class="edited-mark">(edited)</span>' : '';
      
      let msgInfoHTML = `
        <div class="msg-info">
          <span class="name">${msg.name}</span>
          ${!msg.imageUrl ? `
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="time">${time}</span>
            ${ticks}
          </div>
          ` : ''}
        </div>
      `;

      let msgContent = msg.imageUrl ? `
        <div class="image-wrapper" style="width: 250px; height: 250px; background: rgba(0, 0, 0, 0.2); border-radius: 6px; position: relative; overflow: hidden; display: inline-block;">
          <img src="${msg.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer; display: block; margin: 0;" alt="Image" onclick="window.open('${msg.imageUrl}')" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; color: #ef4444; font-size: 13px; text-align: center; position: absolute; top: 0; left: 0; padding: 10px; box-sizing: border-box;">Image Load Failed!<br>Check Firebase Rules</div>
          <div class="image-meta">
            <span class="time">${time}</span>
            ${ticks}
          </div>
        </div>
      ` : `<p>${linkify(msg.text)} ${editedMark}</p>`;

      // Swipe events (mouse + touch) for all messages
      let holdEvents = `onmousedown="handleTouchStart(event, '${msgKey}')" onmousemove="handleTouchMove(event, '${msgKey}')" onmouseup="handleTouchEnd(event, '${msgKey}')" onmouseleave="handleTouchEnd(event, '${msgKey}')" ontouchstart="handleTouchStart(event, '${msgKey}')" ontouchmove="handleTouchMove(event, '${msgKey}')" ontouchend="handleTouchEnd(event, '${msgKey}')" oncontextmenu="event.preventDefault(); return false;"`;

      box.innerHTML += `
        <div id="msg-${msgKey}" class="msg ${side} ${msg.imageUrl ? 'image-msg' : ''}" ${holdEvents}>
          ${msgInfoHTML}
          ${replyHTML}
          ${msgContent}
        </div>
      `;
    }
    box.scrollTop = box.scrollHeight;
  });

  // Message changed listener (রিয়েল-টাইমে ব্লু-টিক আপডেট করার জন্য)
  db.ref("rooms/" + room + "/messages").on("child_changed", snap => {
    let msg = snap.val();
    let msgKey = snap.key;
    chatMessages[msgKey] = msg;

    if (msg.name === userName && msg.status === "read") {
      let tickEl = document.getElementById("tick-" + msgKey);
      if (tickEl) {
        tickEl.classList.add("read");
      }
    }

    // Update text if message is edited
    if (msg.edited) {
      let msgBox = document.getElementById("msg-" + msgKey);
      if (msgBox && !msg.imageUrl) {
        let pTag = msgBox.querySelector("p");
        if (pTag) {
           pTag.innerHTML = linkify(msg.text) + ' <span class="edited-mark">(edited)</span>';
        }
      }
    }
  });

  // Message deleted listener (Real-time removal)
  db.ref("rooms/" + room + "/messages").on("child_removed", snap => {
    let deletedMsg = document.getElementById("msg-" + snap.key);
    if (deletedMsg) deletedMsg.remove();
    delete chatMessages[snap.key];
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

  // Kick listener (If creator removes this user)
  db.ref(`rooms/${room}/users/${userName}`).on("value", snap => {
    if (room && userName && !snap.exists() && !isLeaving) {
      alert("You have been removed from the room by the creator or access changed.");
      forceLeave();
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

  let msgData = {
    name: userName,
    text: text,
    time: Date.now(),
    status: "sent"
  };

  if (replyingTo) {
    msgData.replyTo = replyingTo;
  }

  db.ref("rooms/" + room + "/messages").push(msgData);

  document.getElementById("msg").value = "";
  cancelReply();

  // typing OFF after send
  db.ref(`rooms/${room}/typing/${userName}`).set(false);
}


// =====================
// 🔹 Send Image
// =====================
function uploadImage(event) {
  let fileInput = document.getElementById("imageInput");
  let file = fileInput.files[0];
  if (!file) return;
  if (!room) return alert("You must join a room first.");

  // Validate file type
  if (!file.type.startsWith("image/")) {
    fileInput.value = "";
    return alert("Please select a valid image file.");
  }

  let msgInput = document.getElementById("msg");
  let attachBtn = document.getElementById("attach-btn");
  let progressContainer = document.getElementById("upload-progress");
  let progressRing = document.getElementById("progress-ring-bar");
  let progressPercent = document.getElementById("upload-percent");

  msgInput.placeholder = "Uploading image...";
  msgInput.disabled = true;
  if (attachBtn) attachBtn.style.display = "none";
  if (progressContainer) progressContainer.style.display = "flex";

  let circumference = 113; // Max dash array for the SVG circle

  let storageRef = storage.ref(`chat_images/${room}/${Date.now()}_${file.name}`);
  let uploadTask = storageRef.put(file);
  
  function resetUploadUI() {
    msgInput.placeholder = "Type a message...";
    msgInput.disabled = false;
    if (attachBtn) attachBtn.style.display = "flex";
    if (progressContainer) progressContainer.style.display = "none";
    if (progressRing) progressRing.style.strokeDashoffset = circumference;
    if (progressPercent) progressPercent.innerText = "0%";
    fileInput.value = ""; 
  }

  uploadTask.on('state_changed', 
    function progress(snapshot) {
      let p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      let currentProgress = Math.round(p);
      if (isNaN(currentProgress)) currentProgress = 0;
      let offset = circumference - (currentProgress / 100) * circumference;
      if (progressRing) progressRing.style.strokeDashoffset = offset;
      if (progressPercent) progressPercent.innerText = currentProgress + "%";
    },
    function error(err) {
      console.error("Upload error:", err);
      alert("Image Upload failed! " + err.message);
      resetUploadUI();
    },
    function complete() {
      if (progressPercent) progressPercent.innerText = "100%";
      if (progressRing) progressRing.style.strokeDashoffset = 0;
      
      uploadTask.snapshot.ref.getDownloadURL().then(url => {
        let msgData = { name: userName, text: "📷 Image", imageUrl: url, time: Date.now(), status: "sent" };
        if (replyingTo) msgData.replyTo = replyingTo;
        db.ref("rooms/" + room + "/messages").push(msgData);
        cancelReply();
        resetUploadUI();
      }).catch(err => {
        alert("Failed to get image link: " + err.message);
        resetUploadUI();
      });
    }
  );
}


// =====================
// 🔹 Swipe to Reply Logic
// =====================
function handleTouchStart(e, key) {
  let clientX = e.touches ? e.touches[0].clientX : e.clientX;
  let clientY = e.touches ? e.touches[0].clientY : e.clientY;
  swipeStartX = clientX;
  swipeStartY = clientY;
  holdX = clientX;
  holdY = clientY;
  activeSwipeKey = key; 

  // Start hold timer
  isHolding = true;
  holdTimeout = setTimeout(() => {
    if (isHolding) {
      openMessageOptions(key);
      cancelHold();
    }
  }, 500); // 500ms hold
}

function handleTouchMove(e, key) {
  if (!activeSwipeKey || activeSwipeKey !== key) return;

  let clientX = e.touches ? e.touches[0].clientX : e.clientX;
  let clientY = e.touches ? e.touches[0].clientY : e.clientY;

  let diffX = clientX - swipeStartX;
  let diffY = Math.abs(clientY - swipeStartY);

  if (Math.abs(diffX) > 10 || diffY > 10) {
    cancelHold(); // Move detected, cancel long-press
  }

  if (diffX > 0 && diffY < 30) {
    let el = document.getElementById("msg-" + key);
    if (el) {
      let moveX = diffX > 80 ? 80 + (diffX - 80) * 0.2 : diffX;
      el.style.transform = `translateX(${moveX}px)`;
    }
  }
}

function handleTouchEnd(e, key) {
  cancelHold();

  if (!activeSwipeKey || activeSwipeKey !== key) return;

  let el = document.getElementById("msg-" + key);
  if (el) {
    let currentTransform = el.style.transform;
    let match = currentTransform.match(/translateX\(([^px]+)/);
    if (match) {
      let diffX = parseFloat(match[1]);
      if (diffX > 45) { // Threshold for reply
        triggerReply(key);
      }
    }
    
    el.style.transition = 'transform 0.2s ease-out';
    el.style.transform = 'translateX(0px)';
    setTimeout(() => { if (el) el.style.transition = ''; }, 200);
  }
  activeSwipeKey = null;
}

function triggerReply(msgKey) {
  let msg = chatMessages[msgKey];
  if (!msg) return;
  replyingTo = { key: msgKey, name: msg.name, text: msg.text, imageUrl: msg.imageUrl || null };
  document.getElementById("reply-preview-name").innerText = msg.name === userName ? "You" : msg.name;
  document.getElementById("reply-preview-text").innerText = msg.imageUrl ? "📷 Image" : msg.text;
  document.getElementById("reply-preview").style.display = "flex";
  document.getElementById("msg").focus();
}

function cancelReply() {
  replyingTo = null;
  document.getElementById("reply-preview").style.display = "none";
}

function cancelHold() {
  isHolding = false;
  clearTimeout(holdTimeout);
}


// =====================
// 🔹 Message Options (WhatsApp Style)
// =====================
function openMessageOptions(msgKey) {
  let msg = chatMessages[msgKey];
  if (!msg || msg.name !== userName) return; // Only show for own messages
  
  activeMsgKey = msgKey;
  activeSwipeKey = null; // Prevent swipe glitch
  
  document.getElementById("msg-options-overlay").style.display = "block";
  let menu = document.getElementById("msg-options-menu");
  menu.style.display = "flex";

  // Dropdown positioning for desktop
  if (window.innerWidth > 600) {
    menu.classList.add("desktop-dropdown");
    let menuWidth = 220;
    let menuHeight = 110;
    
    let finalX = holdX;
    let finalY = holdY;
    
    if (finalX + menuWidth > window.innerWidth) finalX = window.innerWidth - menuWidth - 20;
    if (finalY + menuHeight > window.innerHeight) finalY = window.innerHeight - menuHeight - 20;
    
    menu.style.position = "fixed";
    menu.style.left = finalX + "px";
    menu.style.top = finalY + "px";
    menu.style.right = "auto";
    menu.style.bottom = "auto";
  } else {
    menu.classList.remove("desktop-dropdown");
    menu.style.left = "";
    menu.style.top = "";
  }

  setTimeout(() => menu.classList.add("show"), 10);
  
  document.getElementById("edit-msg-btn").style.display = msg.imageUrl ? "none" : "block";
}

function closeMessageOptions() {
  document.getElementById("msg-options-overlay").style.display = "none";
  let menu = document.getElementById("msg-options-menu");
  menu.classList.remove("show");
  setTimeout(() => menu.style.display = "none", 200);
  setTimeout(() => menu.classList.remove("desktop-dropdown"), 200);
  activeMsgKey = null;
}

function unsendMessage() {
  if (!room || !activeMsgKey) return;
  if (confirm("Delete message for everyone?")) {
    db.ref("rooms/" + room + "/messages/" + activeMsgKey).remove();
    closeMessageOptions();
  }
}

function editMessage() {
  if (!room || !activeMsgKey) return;
  let msg = chatMessages[activeMsgKey];
  if (msg && !msg.imageUrl) {
    let newText = prompt("Edit message:", msg.text);
    if (newText !== null && newText.trim() !== "") {
      db.ref("rooms/" + room + "/messages/" + activeMsgKey).update({ 
        text: newText.trim(),
        edited: true 
      });
    }
  }
  closeMessageOptions();
}


// =====================
// 🔹 Room Info & Manage
// =====================
function openRoomInfo() {
  if (!room) return;
  document.getElementById("room-info-panel").classList.add("open");

  db.ref("rooms/" + room).once("value", snap => {
    let data = snap.val() || {};
    let activeUsers = data.users || {};
    let allUsers = data.allUsers || {};

    // Migrate active users to allUsers for older rooms on the fly
    Object.keys(activeUsers).forEach(u => {
      if (!allUsers[u]) allUsers[u] = "active";
    });

    let listHTML = "";
    let manageHTML = "";

    Object.keys(allUsers).forEach(u => {
      let isActive = activeUsers[u] ? true : false;
      let statusText = isActive ? "<span style='color:#00a884;'>Active</span>" : "<span style='color:#ef4444;'>Left</span>";

      listHTML += `<div class="room-info-item" style="padding: 4px 0;">
        <span>${u} ${u === data.creator ? '<span style="font-size:11px; color:#a1a1aa; margin-left:5px;">(Creator)</span>' : ''}</span> 
        ${statusText}
      </div>`;

      // Only show currently ACTIVE members for kicking
      if (isCreator && u !== userName && isActive) {
        manageHTML += `<label class="room-info-item" style="cursor:pointer; padding: 4px 0;">
          <span>${u}</span>
          <input type="checkbox" class="manage-user-cb" value="${u}" checked>
        </label>`;
      }
    });

    document.getElementById("info-members-list").innerHTML = listHTML || "<p style='color:#94a3b8;'>No history found.</p>";

    if (isCreator) {
      document.getElementById("creator-manage-section").style.display = "block";
      document.getElementById("manage-members-list").innerHTML = manageHTML || "<p style='font-size:13px; color:#94a3b8;'>No other active members to manage.</p>";
      document.getElementById("new-room-password").value = "";
    } else {
      document.getElementById("creator-manage-section").style.display = "none";
    }
  });
}

function closeRoomInfo() {
  let panel = document.getElementById("room-info-panel");
  if (panel) {
    panel.classList.remove("open");
  }
}

function saveRoomChanges() {
  if (!room || !isCreator) return;

  let newPass = document.getElementById("new-room-password").value.trim();
  let checkboxes = document.querySelectorAll(".manage-user-cb");
  let updates = {};

  if (newPass) {
    let passError = validatePassword(newPass);
    if (passError) {
      alert("New Password " + passError.toLowerCase());
      return;
    }
    updates["rooms/" + room + "/password"] = newPass;

    let savedRooms = JSON.parse(localStorage.getItem("savedRooms") || "{}");
    savedRooms[room] = newPass;
    localStorage.setItem("savedRooms", JSON.stringify(savedRooms));
  }

  checkboxes.forEach(cb => {
    if (!cb.checked) {
      let uName = cb.value;
      updates["rooms/" + room + "/users/" + uName] = null; // Kick them
      updates["rooms/" + room + "/allUsers/" + uName] = "left"; // Mark as left
    }
  });

  if (Object.keys(updates).length > 0) {
    db.ref().update(updates).then(() => {
      alert("Room settings updated successfully!");
      closeRoomInfo();
    }).catch(err => alert("Error: " + err.message));
  } else {
    closeRoomInfo();
  }
}


// =====================
// 🔹 Leave Function
// =====================
function leave() {
  if (!room || !userName) return;
  isLeaving = true;

  // Set typing to false before leaving
  db.ref(`rooms/${room}/typing/${userName}`).set(false);
  
  // Remove user from active users list
  db.ref(`rooms/${room}/users/${userName}`).remove();
  db.ref(`rooms/${room}/allUsers/${userName}`).set("left");

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
  db.ref("rooms/" + room + "/users").off();

  // UI Changes
  document.getElementById("chat").style.display = "none";
  document.getElementById("join").style.display = "flex";
  document.getElementById("messages").innerHTML = "";
  cancelReply();

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

function forceLeave() {
  isLeaving = true;
  if (!room) return;

  db.ref("rooms/" + room + "/messages").off();
  db.ref("rooms/" + room + "/typing").off();
  db.ref("rooms/" + room + "/maxLimit").off();
  db.ref("rooms/" + room + "/users").off();
  if (userName) db.ref(`rooms/${room}/users/${userName}`).off();

  document.getElementById("chat").style.display = "none";
  document.getElementById("join").style.display = "flex";
  document.getElementById("messages").innerHTML = "";
  cancelReply();

  room = null;
  userName = null;
  isCreator = false;
  document.getElementById("join-room").value = "";
  document.getElementById("join-password").value = "";
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
      db.ref(`rooms/${room}/allUsers/${userName}`).set("left");
    db.ref("rooms/" + room + "/messages").push({
      type: "system",
      text: userName + " left the chat",
      time: Date.now()
    });
  }

});