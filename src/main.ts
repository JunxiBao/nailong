import './style.css';
import { GameApp } from './ui/GameApp';

const appRoot = document.getElementById('app');
if (appRoot) {
  new GameApp(appRoot);
}
