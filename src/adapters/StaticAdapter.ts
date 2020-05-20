import { Location } from 'history';
import { RouterState, RouterStore } from '../stores';
import { createMatchingRouterState } from './createMatchingRouterState';

/**
 * Responsible for driving `RouterState` programmatically instead of the
 * Browser bar. This is useful in server-side rendering scenarios where
 * the user isn’t actually clicking around, so the location never actually
 * changes. Hence, the name `static`.
 */
export class StaticAdapter {
    routerStore: RouterStore;

    constructor(routerStore: RouterStore) {
        this.routerStore = routerStore;
    }

    goToLocation = (location: Location): Promise<RouterState> => {
        // /* istanbul ignore if */
        // if (process.env.NODE_ENV === 'development') {
        //     console.log(
        //         `StaticAdapter.goToLocation(${JSON.stringify(location)})`
        //     );
        // }

        // Create the matching RouterState
        const routerState = createMatchingRouterState(
            location,
            this.routerStore.routes
        );
        if (routerState) {
            return this.routerStore.goTo(routerState.routeName, routerState);
        } else {
            return this.routerStore.goToNotFound();
        }
    };
}