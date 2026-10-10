//Login test script for the backend server DELETE LATER
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
);

async function testLogin() {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error("Login failed:", error.message);
        return;
    }

    console.log("Login successful!");

    const response = await fetch("http://localhost:3000/api/me", {
        headers: {
            Authorization: `Bearer ${data.session.access_token}`
        }
    });

    console.log("API status:", response.status);
    console.log("API response:", await response.json());
}

testLogin().catch(console.error);
