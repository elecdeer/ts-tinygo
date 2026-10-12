import { greet, type User } from "./user.js";

const ok: User = { id: 1, name: "Alice" };
console.log(greet(ok));

// error: Type 'string' is not assignable to type 'number'.
const bad: User = { id: "2", name: "Bob" };

// error: 'email' is possibly 'undefined'.
const domain = ok.email.split("@")[1];

// error: Property 'nmae' does not exist on type 'User'.
console.log(bad.nmae, domain);

const ids = [1, 2, 3].map((n) => n * 2);
// error: Argument of type 'number[]' is not assignable to parameter of type 'User'.
greet(ids);
