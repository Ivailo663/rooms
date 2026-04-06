import { computed, watchEffect } from 'vue'

export function useAuthenticatedUser() {
  watchEffect(async () => {
    // console.log('calleds')
    // if (isAuthenticated.value && !isLoading.value) {
    //   try {
    //     accessToken.value = await getAccessTokenSilently({
    //       authorizationParams: {
    //         audience: 'https://football.com',
    //       },
    //     })
    //   } catch (error) {
    //     console.error('Failed to get access token:', error)
    //   }
    // }
  })

  return {
    user: computed(() => ''),
    accessToken: computed(() => ''),
    isAuthenticated: computed(() => ''),
    isLoading: computed(() => ''),
  }
}
