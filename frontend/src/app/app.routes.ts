import { Routes } from '@angular/router';
import { BandeirasPage } from './features/bandeiras/pages/bandeiras-page/bandeiras-page';
import { DistribuidorasPage } from './features/distribuidoras/pages/distribuidoras-page/distribuidoras-page';
import { HomePage } from './features/home/pages/home-page/home-page';
import { NotFoundPage } from './features/not-found/pages/not-found-page/not-found-page';
import { SimuladorPage } from './features/simulador/pages/simulador-page/simulador-page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'simulador', component: SimuladorPage },
  { path: 'distribuidoras', component: DistribuidorasPage },
  { path: 'bandeiras', component: BandeirasPage },
  { path: '**', component: NotFoundPage },
];
