const commands = [
	["bun", "--watch", "mock/server.ts"],
	["vp", "dev"],
];

const children = commands.map((cmd) =>
	Bun.spawn({ cmd, stdio: ["inherit", "inherit", "inherit"] }),
);

const stop = () => {
	for (const child of children) child.kill();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const code = await Promise.race(children.map((child) => child.exited));
stop();
process.exit(code);
