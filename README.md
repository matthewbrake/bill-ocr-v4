# AI Bill Analyzer

An advanced, intuitive application that uses the power of multimodal AI to scan, analyze, and verify utility bills. It supports both Google Gemini for cloud-based processing and local Ollama models for offline privacy. Features include enhanced debugging, connection testing, dynamic model discovery, and interactive data verification to ensure accuracy.

![AI Bill Analyzer Screenshot](https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/bill-analyzer-screenshot.png)

## Core Features

-   **Dual AI Provider Support**: Seamlessly switch between **Google Gemini** (gemini-2.5-flash) for powerful cloud-based analysis and any local **Ollama** model for offline, privacy-focused processing.
-   **Intelligent OCR & Data Extraction**: Extracts key information including account details, line items, total charges, and complex usage data from bar charts.
-   **Interactive Data Verification**: If the AI is uncertain about a piece of data (e.g., a blurry number), it flags the field and asks the user a direct question for verification.
-   **Editable Data Tables**: All extracted data, especially from usage charts, is presented in editable tables, allowing you to correct any AI inaccuracies.
-   **Dynamic Ollama Integration**: Automatically tests the connection to your Ollama server and dynamically fetches a list of your available models.
-   **Data Export**: Export extracted line items and usage data to CSV with a single click for use in spreadsheets or financial software.
-   **Formspree Submission**: Securely submit the analyzed bill data to a configurable Formspree endpoint, perfect for sending results via email or triggering backend workflows.
-   **Advanced Debugging**: An optional real-time debug log provides deep insight into the application's state, API requests, and responses.
-   **Persistent History**: Your analysis history is saved in your browser's local storage, allowing you to revisit past bills.
-   **Dark Mode & Responsive UI**: A clean, modern interface that works beautifully on all screen sizes and includes a theme toggle.
-   **Ready to Deploy**: Comes with a multi-stage `Dockerfile` and `docker-compose.yml` for easy, secure, and efficient containerized deployment.

---

## Getting Started (Local Development)

Follow these steps to run the AI Bill Analyzer on your local machine.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or newer)
-   [npm](https://www.npmjs.com/) (usually included with Node.js)

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/ai-bill-analyzer.git
cd ai-bill-analyzer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root of the project by copying the example file:

```bash
cp .env.example .env
```

Now, open the `.env` file and add your keys:

```
# Your Google Gemini API Key. Get one from Google AI Studio.
# This is required for the Gemini provider to work.
API_KEY="YOUR_GEMINI_API_KEY_HERE"

# Optional: Your Formspree form ID for the "Submit Results" button.
# Create a free form endpoint at https://formspree.io/
FORMSPREE_FORM_ID="YOUR_FORMSPREE_ID_HERE"
```

### 4. Build the Application

This command runs the `esbuild` bundler, which compiles the TypeScript/React code and injects your environment variables into the static assets in the `dist/` directory.

```bash
npm run build
```

### 5. Serve the Application

We use the `serve` package for a simple but effective local server.

**To run on the default port (3000):**
```bash
npm start
```

**To specify a custom port (e.g., 5000):**
```bash
npm start -- -l 5000
```

Your AI Bill Analyzer is now running. Open your browser to the specified address (e.g., `http://localhost:3000` or `http://localhost:5000`).

---

## Updating the Application

To update your local application to the latest version, you can pull the changes from the repository and rebuild the project.

### Quick Update Command

Run the following command from the project's root directory. This will download the latest code, install any new dependencies, and rebuild the application files.

```bash
git pull && npm install && npm run build
```

After the command completes successfully, you can start the server with the latest version:

```bash
# Start on the default port (3000)
npm start

# Or on a custom port (e.g., 5000)
npm start -- -l 5000
```

---

## Deployment with Docker

Containerizing the application is the recommended way to deploy it in production.

### 1. Build the Docker Image

From the project root, run the following command. The build process will use the environment variables from your `.env` file.

```bash
docker-compose build
```

### 2. Run the Container

Start the application using Docker Compose. This will run the container in the background (`-d`).

```bash
docker-compose up -d
```

The application is now accessible at `http://localhost:8080` (or whichever port you specified in `docker-compose.yml`).

### Changing the Port

To run the application on a different port, simply edit the `ports` section in the `docker-compose.yml` file. For example, to run on port `80`, change it to:

```yaml
services:
  app:
    # ...
    ports:
      - "80:80" # Maps host port 80 to container port 80
```

Then, rebuild and restart your container: `docker-compose up -d --build`.

### Stopping the Container

```bash
docker-compose down
```

---

## Technical Notes

### Why Formspree instead of SMTP?

Modern web browsers have strict security policies that prevent client-side JavaScript from directly connecting to an SMTP server. This is to protect user credentials and prevent browsers from being used to send spam. Formspree acts as a secure intermediary:
1.  The app sends the data to your Formspree endpoint.
2.  Formspree processes it on their secure server.
3.  Formspree sends the email or triggers a webhook on your behalf.

This is the industry-standard way to handle form submissions and email from static web applications.

### Why can't I save CSVs to a folder?

For the same security reasons, a web browser cannot write files directly to a user's file system. The application can only initiate a download, and the user (or their browser settings) determines the final save location, which is typically the "Downloads" folder. This protects users from malicious websites writing files without permission.