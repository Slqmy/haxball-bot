import {log} from "../utils/log";

import net, { Server, Socket } from "net";

import chalk from "chalk";

export enum RoomDebuggingMessageType {
	UpdateRooms,
	AddRoom,
	RemoveRoom,
}

export class DebuggingServer {
	server: Server;
	sockets: Socket[] = [];

	roomServers: number[] = [];

	constructor() {
		this.server = net.createServer();
	}

	private message(
		socket: Socket,
		type: RoomDebuggingMessageType,
		message: any,
	) {
		const msg = JSON.stringify({type, message});

		socket.write(msg);
	}

	private broadcast(type: RoomDebuggingMessageType, message: any) {
		this.sockets.forEach((server) => {
			this.message(server, type, message);
		});
	}

	listen(port: number) {
		this.server.on("listening", () => {
			log(
				"REMOTE DEBUGGING",
				chalk.yellow(`Listening to remote connections on port ${port}`),
			);
		});

		this.server.on("connection", (socket) => {
			socket.setEncoding("utf8");

			this.sockets.push(socket);

			this.message(
				socket,
				RoomDebuggingMessageType.UpdateRooms,
				this.roomServers,
			);
		});

		this.server.on("error", (err) => {
			if (err.message.includes("EADDRINUSE")) {
				log(
					"FATAL ERROR",
					chalk.red(`Remote debugging port ${port} is already in use. Make sure you are not running another instance of Haxball Server in the background.`),
				);
				process.exit();
			} else {
				throw err;
			}
		});

		this.server.listen(port, "localhost");
	}

	setRooms(rooms: number[]) {
		this.roomServers = rooms;
		this.broadcast(RoomDebuggingMessageType.UpdateRooms, rooms);

		log("UPDATE ROOM PORTS", chalk.gray(rooms.join(", ")));
	}

	addRoom(room: number) {
		this.roomServers.push(room);
		this.broadcast(RoomDebuggingMessageType.AddRoom, room);

		log("ADD ROOM PORT", chalk.gray(`${room}`));
	}

	removeRoom(room: number) {
		if (!this.roomServers.includes(room)) {
			return
		};

		this.roomServers = this.roomServers.filter((r) => r !== room);
		this.broadcast(RoomDebuggingMessageType.RemoveRoom, room);

		log("DELETE ROOM PORT", chalk.gray(`${room}`));
	}
}
