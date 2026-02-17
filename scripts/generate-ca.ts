console.log("CA certificate generation not yet implemented.");
console.log("For HTTPS interception, run:");
console.log(
	"  openssl req -x509 -newkey rsa:2048 -keyout homerun-ca-key.pem -out homerun-ca.pem -days 365 -nodes",
);
