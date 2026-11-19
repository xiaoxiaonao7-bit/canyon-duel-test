const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 房間管理
const rooms = {};

io.on('connection', (socket) => {
  console.log('玩家連線：', socket.id);

  // 建立房間
  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).slice(2, 8);
    rooms[roomId] = {
      players: [socket.id],
      ready: [false, false]
    };
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
    console.log('建立房間', roomId);
  });

  // 加入房間
  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) {
      socket.emit('joinFail', '房間不存在');
      return;
    }
    if (rooms[roomId].players.length >= 2) {
      socket.emit('joinFail', '房間已滿');
      return;
    }
    rooms[roomId].players.push(socket.id);
    socket.join(roomId);
    io.to(roomId).emit('roomJoinSuccess', {
      roomId,
      playerCount: rooms[roomId].players.length
    });
    console.log(socket.id, '加入房間', roomId);
  });

  // 玩家就緒
  socket.on('playerReady', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const idx = room.players.indexOf(socket.id);
    if (idx === -1) return;
    room.ready[idx] = true;
    // 兩人都準備好就開局
    if (room.ready[0] && room.ready[1]) {
      io.to(roomId).emit('gameStart');
    }
  });

  // 轉發遊戲狀態（核心：伺服器不處理遊戲邏輯，只轉送）
  socket.on('gameState', (roomId, state) => {
    socket.to(roomId).emit('remoteState', state);
  });

  // 斷線處理
  socket.on('disconnect', () => {
    console.log('玩家離線：', socket.id);
    for (const rid in rooms) {
      const room = rooms[rid];
      const pIndex = room.players.indexOf(socket.id);
      if (pIndex !== -1) {
        io.to(rid).emit('opponentLeave');
        delete rooms[rid];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('伺服器啟動，埠號：', PORT);
});
