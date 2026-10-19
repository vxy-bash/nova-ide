# Nova IDE

A desktop code editor with a React interface, Monaco editor and Python backend. Electron opens the local app; the backend handles files, terminal commands and model requests.

This is a development project. Some internal names still use FableOS.

## Run locally

Install Python 3.10+ and Node.js 22.12+ with npm. From the repository root:

```sh
python -m pip install -r backend/requirements.txt
npm ci
npm ci --prefix frontend
npm run build --prefix frontend
npm start
```

Electron starts the backend on `127.0.0.1:8000`. On Windows, `start.bat` runs `npm start`; it does not install dependencies.

## Structure

- `frontend/src/`: editor interface, panels and model selection
- `backend/main.py`: FastAPI server and model integration
- `main.js`: Electron window and backend process
- `build_release.py`: release helper

For frontend development, run `python main.py` from `backend/` and `npm run dev` from `frontend/` in separate terminals. Model access depends on the provider configured in the app.
