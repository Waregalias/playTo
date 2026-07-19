import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then(m => m.HomeComponent),
  },
  {
    path: 'game',
    pathMatch: 'full',
    redirectTo: 'game/map',
  },
  {
    // The active tab lives in the URL so every screen can be bookmarked/shared.
    path: 'game/:tab',
    loadComponent: () => import('./game/game').then(m => m.GameComponent),
  },
];
