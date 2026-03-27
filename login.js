const REMEMBERED_EMAIL_KEY = "loginRememberedEmail";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const rememberInput = document.getElementById("rememberInput");
const loginBtn = document.getElementById("loginBtn");
const formMessage = document.getElementById("formMessage");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const providerButtons = document.querySelectorAll(".provider-btn");

const updateMessage = (text, state = "") => {
  formMessage.textContent = text;
  formMessage.dataset.state = state;
};

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

const syncRememberedEmail = () => {
  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
  if (!rememberedEmail) return;
  emailInput.value = rememberedEmail;
  rememberInput.checked = true;
};

const persistRememberedEmail = (email) => {
  if (rememberInput.checked) {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    return;
  }
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
};

togglePasswordBtn.addEventListener("click", () => {
  const willShow = passwordInput.type === "password";
  passwordInput.type = willShow ? "text" : "password";
  togglePasswordBtn.textContent = willShow ? "Hide" : "Show";
  togglePasswordBtn.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
});

providerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider || "Third-party sign in";
    updateMessage(`${provider} is wired as a placeholder in this mockup so the page still feels interactive.`);
  });
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    updateMessage("Please enter both your email and password.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    updateMessage("Please enter a valid email address.", "error");
    emailInput.focus();
    return;
  }

  if (password.length < 6) {
    updateMessage("Your password must be at least 6 characters.", "error");
    passwordInput.focus();
    return;
  }

  persistRememberedEmail(email);
  loginBtn.disabled = true;
  updateMessage("Verifying your credentials and preparing your workspace...");

  window.setTimeout(() => {
    updateMessage("Signed in successfully. Redirecting to the product demo...", "success");
    window.setTimeout(() => {
      window.location.href = "/";
    }, 900);
  }, 1000);
});

syncRememberedEmail();
