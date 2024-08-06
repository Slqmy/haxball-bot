import * as Global from "../Global";

import EventEmitter from "events";
import {RoomDebuggingMessageType} from "./DebuggingServer";

import {getAvailablePort} from "../utils/getAvailablePort";

import net from "net";

import chalk from "chalk";

export class DebuggingClient extends EventEmitter {
	private roomsConn: {server: number; client: number}[] = [];

	client?: net.Socket;

	get rooms() {
		return this.roomsConn.map((r) => r.client);
	}

	get size() {
		return this.rooms.length;
	}

	// eslint-disable-next-line no-useless-constructor
	constructor() {
		super();
	}

	listen(port: number) {
		this.client = new net.Socket();

		this.client.connect(port, "localhost", () => {
			console.log(chalk.yellow("Listening to client tunnel"));
		});

		this.client.on("data", async (data) => {
			try {
				const str = data.toString("utf-8");
				const json = JSON.parse(str);

				if (json.type === RoomDebuggingMessageType.UpdateRooms) {
					const r = [];

					let prevPort = Global.clientRoomFirstPort;

					for (const serverPort of json.message) {
						const availablePort = await getAvailablePort(prevPort);

						r.push({server: serverPort, client: availablePort});

						prevPort = availablePort + 1;
					}

					this.roomsConn = r;

					this.emit("set", r);
				}

				if (json.type === RoomDebuggingMessageType.AddRoom) {
					// eslint-disable-next-line @typescript-eslint/no-shadow
					const port = await getAvailablePort(Global.clientRoomFirstPort);

					this.roomsConn.push({server: json.message, client: port});
					this.emit("add", json.message, port);
				}

				if (json.type === RoomDebuggingMessageType.RemoveRoom) {
					// eslint-disable-next-line @typescript-eslint/no-shadow
					const port = this.roomsConn.find((r) => r.server === json.message)
						?.client;

					this.roomsConn = this.roomsConn.filter(
						(r) => r.server !== json.message,
					);
					this.emit("remove", json.message, port);
				}
			} catch (err) {
				console.error(err);
			}
		});

		this.client.on("close", () => {
			console.log(chalk.gray("Connection to debugging server closed"));
		});

		this.client.on("error", (err) => {
			console.error(err);

			this.client?.destroy();
		});

		this.client.on("timeout", () => {
			console.log(chalk.red("Connection to debugging server timed out"));

			this.client?.destroy();
		});
	}
}
