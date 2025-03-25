const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector(".chat-messages");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");
const leaveBtn = document.getElementById("leave-btn");

// Extract username and room from URL
const { username, room } = Qs.parse(location.search, {
	ignoreQueryPrefix: true,
});

const socket = io();

// Join the chat room
socket.emit("joinRoom", { username, room });

// Listen for room info update
socket.on("roomUsers", ({ room, users }) => {
	updateRoomName(room);
	updateUserList(users);
});

// Listen for messages from server
socket.on("message", (message) => {
	console.log(message);
	displayMessage(message);
	scrollToBottom();
});

// Handle message submission
chatForm.addEventListener("submit", (e) => {
	e.preventDefault();

	const msgInput = e.target.elements.msg;
	const message = msgInput.value.trim();

	if (!message) return;

	// Emit message to server
	socket.emit("chatMessage", message);

	// Clear input field and refocus
	msgInput.value = "";
	msgInput.focus();
});

// Display a new message in the chat window
function displayMessage(message) {
	const messageDiv = document.createElement("div");
	messageDiv.classList.add("message");

	messageDiv.innerHTML = `
        <p class="meta">${message.username} <span>${message.time}</span></p>
        <p class="text">${message.text}</p>
      <p> use @ai to ask a question</p>
    `;

	chatMessages.appendChild(messageDiv);
}

// Update room name in the DOM
function updateRoomName(room) {
	roomName.textContent = room;
}

// Update user list in the DOM
function updateUserList(users) {
	userList.innerHTML = users
		.map((user) => `<li>${user.username}</li>`)
		.join("");
}

// Scroll chat to the bottom
function scrollToBottom() {
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Prompt user before leaving the chat room
leaveBtn.addEventListener("click", () => {
	if (confirm("Are you sure you want to leave the chatroom?")) {
		window.location = "../index.html";
	}
});
