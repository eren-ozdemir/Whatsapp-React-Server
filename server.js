require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const path = require("path");
const cors = require("cors"); //Allows server and client communicate from same machine
const reload = require("reload");
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require("fs");
const { v4: uuidV4 } = require("uuid");
const e = require("express");
let users = [];
let chatLog = [];

app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

app.use(express.json());

app.get("/users", (req, res) => {
  res.send(users);
});

//Read User Log File
fs.readFile("./logs/userLog.json", "utf8", (err, jsonString) => {
  if (err) {
    console.log("File read failed:", err);
    return;
  }
  if (jsonString != "") users = JSON.parse(jsonString);
});

//Read Chat Log File
fs.readFile("./logs/chatLog.json", "utf8", (err, jsonString) => {
  if (err) {
    console.log("File read failed:", err);
    return;
  }
  if (jsonString != "") chatLog = JSON.parse(jsonString);
});

function saveUserLog() {
  fs.writeFile("./logs/userLog.json", JSON.stringify(users), (err) => {
    if (err) console.log("Error writing file:", err);
  });
}

function saveChatLog() {
  fs.writeFile("./logs/chatLog.json", JSON.stringify(chatLog), (err) => {
    if (err) console.log("Error writing file:", err);
  });
}

//socket.io
io.on("connection", (socket) => {
  socket.on("setSocketId", (userId) => {
    users.map((u) => {
      if (u.id === userId) u.socketId = socket.id;
    });
    saveUserLog();
  });

  //Add User
  socket.on("addId", (id) => {
    let user = {
      socketId: socket.id,
      id: id,
      nickNames: null,
      friends: [],
    };
    users.push(user);
    saveUserLog();
  });

  socket.on("addFriend", (userId, friendId, friendName) => {
    userIndex = users.findIndex((u) => u.id == userId);
    friendIndex = users.findIndex((u) => u.id == friendId);
    //Check friend existence
    if (friendIndex !== -1) {
      const chatId = uuidV4();
      const isFriend = users[userIndex].friends.find((f) => f.id === friendId);
      if (!isFriend) {
        users[userIndex].friends.push({
          id: friendId,
          name: friendName,
          chatId: chatId,
        });

        users[friendIndex].friends.push({
          id: userId,
          name: null,
          chatId: chatId,
        });
        console.log(users[friendIndex].socketId);
        saveUserLog();
      }
      //Create Chat Log
      chatLog.push({ chatId: chatId, messages: [] });
      saveChatLog();
      io.to(users[friendIndex].socketId).emit("friendAdded");
    }
  });

  socket.on("setChat", (socketId, userId, friendId) => {
    const user = findUserById(userId);
    const friendUnderUser = findInFriendsById(user, friendId);
    const chatId = friendUnderUser.chatId;
    const log = chatLog.find((log) => log.chatId == chatId);
    if (log) {
      io.to(socketId).emit("loadMessages", chatId, log.messages);
    }
  });

  socket.on("sendMessage", (chatId, friendId, msg) => {
    let log = chatLog.find((log) => log.chatId === chatId);
    if (log) log.messages.push(msg);
    saveChatLog();
    const friend = users.find((f) => f.id === friendId);
    io.to(friend.socketId).emit("receiveMessage", chatId, msg);
  });

  socket.on("rename", (socketId, userId, friendId, newName) => {
    const user = findUserById(userId);
    const friendUnderUser = findInFriendsById(user, friendId);
    friendUnderUser.name = newName;
    saveUserLog();
  });

  socket.on("disconnect", async () => {
    console.log("Disconnected", socket.id);
    saveUserLog();
  });
});

const findUserById = (id) => {
  return users.find((u) => u.id === id);
};

const findInFriendsById = (user, id) => {
  return user.friends.find((f) => f.id === id);
};

server.listen(3001, () => console.log("Server started"));
reload(app);
