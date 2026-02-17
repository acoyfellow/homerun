import { describe, expect, test } from "bun:test";
import { inferSchema } from "../../src/bun/discovery/inferrer";

describe("inferSchema", () => {
	test("infers string type", () => {
		const schema = inferSchema("hello");
		expect(schema.type).toBe("string");
		expect(schema.example).toBe("hello");
	});

	test("infers integer type", () => {
		const schema = inferSchema(42);
		expect(schema.type).toBe("integer");
	});

	test("infers number type for floats", () => {
		const schema = inferSchema(3.14);
		expect(schema.type).toBe("number");
	});

	test("infers boolean type", () => {
		const schema = inferSchema(true);
		expect(schema.type).toBe("boolean");
	});

	test("infers null type", () => {
		const schema = inferSchema(null);
		expect(schema.type).toBe("null");
	});

	test("infers array type with item schema", () => {
		const schema = inferSchema([1, 2, 3]);
		expect(schema.type).toBe("array");
		expect(schema.items?.type).toBe("integer");
	});

	test("infers object with properties", () => {
		const schema = inferSchema({ name: "test", age: 25 });
		expect(schema.type).toBe("object");
		expect(schema.properties?.name?.type).toBe("string");
		expect(schema.properties?.age?.type).toBe("integer");
		expect(schema.required).toContain("name");
		expect(schema.required).toContain("age");
	});

	test("detects date-time format", () => {
		const schema = inferSchema("2024-01-15T10:30:00Z");
		expect(schema.format).toBe("date-time");
	});

	test("detects date format", () => {
		const schema = inferSchema("2024-01-15");
		expect(schema.format).toBe("date");
	});

	test("detects email format", () => {
		const schema = inferSchema("user@example.com");
		expect(schema.format).toBe("email");
	});

	test("detects URI format", () => {
		const schema = inferSchema("https://example.com/api");
		expect(schema.format).toBe("uri");
	});

	test("detects UUID format", () => {
		const schema = inferSchema("550e8400-e29b-41d4-a716-446655440000");
		expect(schema.format).toBe("uuid");
	});

	test("handles nested objects", () => {
		const schema = inferSchema({
			user: { name: "test", address: { city: "NYC" } },
		});
		expect(schema.type).toBe("object");
		expect(schema.properties?.user?.type).toBe("object");
		expect(schema.properties?.user?.properties?.address?.type).toBe("object");
	});
});
