import { valueEqual } from '@react-force/utils';
import { action, decorate, observable } from 'mobx';
import { createRouterState, RouterState } from './RouterState';

/**
 * A function called when transitioning from fromState to toState.
 * If it returns a RouterState, then the router redirects to that state.
 * If it returns a void, then the router proceeds to the next transition hook.
 * When no more hooks are left, it simply navigates to toState.
 */
export type TransitionHook = (
    fromState: RouterState,
    toState: RouterState,
    routerStore: RouterStore
) => Promise<RouterState | void>;

/**
 * A `Route` consists of a name, a URL matching pattern and optional
 * enter/exit hooks. The `RouterStore` is initialized with an array
 * of routes which it uses to transition between states.
 */
export interface Route {
    name: string; // e.g. 'department'
    pattern: string; // e.g. '/departments/:id'
    beforeExit?: TransitionHook;
    beforeEnter?: TransitionHook;
    onExit?: TransitionHook;
    onEnter?: TransitionHook;
}

const InitialRouteName = '__initial__';
const InitialRoute = {
    name: InitialRouteName,
    pattern: '',
};
const InitialRouterState = createRouterState(InitialRouteName);

/**
 * Holds the router state. It allows transitioning between states using
 * the `goTo()` method.
 */
export class RouterStore {
    routes: Route[];
    notFoundState: RouterState;
    routerState: RouterState;
    options: { [key: string]: any };

    /**
     * @param routes: Route[]
     *   Any array of routes that will be used by the router
     *   to transition between states.
     *
     * @param notFoundState: RouterState
     *   The state the router will transition to if it does not
     *   know about the requested goTo state.
     *
     * @param options (optional) { [key: string]: any }
     *   Any key-value pair that application wants to stuff in RouterStore.
     *   The following options have special meaning to mobx-state-router.
     *
     *   initialState: RouterState
     *     The initial state of the router. If not specified, the router
     *     will be initialized to an internal default state and will wait
     *     for history to drive the next state.
     */
    constructor(
        routes: Route[],
        notFoundState: RouterState,
        options: { [key: string]: any } = {}
    ) {
        // Set routes and push an internal route for the default state
        this.routes = routes;
        this.routes.push(InitialRoute);

        // Set options
        const defaultOptions = {
            initialState: InitialRouterState,
        };
        this.options = Object.assign(defaultOptions, options);

        // Set states
        this.notFoundState = notFoundState;
        this.routerState = this.options.initialState;
    }

    setRouterState(routerState: RouterState) {
        this.routerState = routerState;
    }

    /**
     * Requests a transition to a new state. Note that the actual transition
     * may be different from the requested one based on enter and exit hooks.
     */
    goTo(
        routeName: string,
        options: Partial<RouterState> = {}
    ): Promise<RouterState> {
        const toState = createRouterState(routeName, options);
        const fromState = this.routerState;
        return this.transition(fromState, toState);
    }

    goToState(toState: RouterState): Promise<RouterState> {
        const fromState = this.routerState;
        return this.transition(fromState, toState);
    }

    goToNotFound(): Promise<RouterState> {
        this.setRouterState(this.notFoundState);
        return Promise.resolve(this.notFoundState);
    }

    getRoute(routeName: string): Route | undefined {
        return this.routes.find((route) => route.name === routeName);
    }

    getCurrentRoute(): Route | undefined {
        return this.getRoute(this.routerState.routeName);
    }

    getNotFoundRoute(): Route {
        const routeName = this.notFoundState.routeName;
        const route = this.getRoute(routeName);
        if (!route) {
            throw new Error(`Route ${routeName} does not exist`);
        }
        return route;
    }

    /**
     * Requests a transition from fromState to toState. Note that the
     * actual transition may be different from the requested one
     * based on enter and exit hooks.
     */
    private async transition(
        fromState: RouterState,
        toState: RouterState
    ): Promise<RouterState> {
        // If fromState = toState, do nothing
        // This is important to avoid infinite loops caused by RouterStore.goTo()
        // triggering a change in history, which in turn causes HistoryAdapter
        // to call RouterStore.goTo().
        if (valueEqual(fromState, toState)) {
            /* istanbul ignore if */
            if (process.env.NODE_ENV === 'development') {
                // const fromStateStr = JSON.stringify(fromState);
                // console.log(
                //     `RouterStore.transition(${fromStateStr}):`,
                //     'states are equal, skipping'
                // );
            }
            return toState;
        }

        // /* istanbul ignore if */
        // if (process.env.NODE_ENV === 'development') {
        //     const fromStateStr = JSON.stringify(fromState);
        //     const toStateStr = JSON.stringify(toState);
        //     console.log(
        //         `RouterStore.transition(${fromStateStr}, ${toStateStr})`
        //     );
        // }

        // Get transition hooks from the two states
        const fromRoute = this.getRoute(fromState.routeName);
        const toRoute = this.getRoute(toState.routeName);
        if (!fromRoute || !toRoute) {
            this.setRouterState(this.notFoundState);
            return toState;
        }
        const { beforeExit, onExit } = fromRoute;
        const { beforeEnter, onEnter } = toRoute;

        // Call the transition hook chain
        let redirectState;

        // ----- beforeExit -----
        if (beforeExit) {
            redirectState = await beforeExit(fromState, toState, this);
            if (redirectState) {
                this.setRouterState(redirectState);
                return redirectState;
            }
        }

        // ----- beforeEnter -----
        if (beforeEnter) {
            redirectState = await beforeEnter(fromState, toState, this);
            if (redirectState) {
                this.setRouterState(redirectState);
                return redirectState;
            }
        }

        // ----- onExit -----
        if (onExit) {
            redirectState = await onExit(fromState, toState, this);
            if (redirectState) {
                this.setRouterState(redirectState);
                return redirectState;
            }
        }

        // ----- onEnter -----
        if (onEnter) {
            redirectState = await onEnter(fromState, toState, this);
            if (redirectState) {
                this.setRouterState(redirectState);
                return redirectState;
            }
        }

        // No redirection happened in the redirect chain.
        // So transition to toState.
        this.setRouterState(toState);
        return toState;
    }
}

decorate(RouterStore, {
    routerState: observable.ref,
    setRouterState: action,
});