export const TEST_RESULTS_KEY = 'soc_test_results'
const MAX_TEST_RESULTS = 50

export function getTestResults() {
  try {
    const raw = localStorage.getItem(TEST_RESULTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTestResults(results) {
  const clean = Array.isArray(results) ? results.slice(0, MAX_TEST_RESULTS) : []
  localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(clean))
  return clean
}

export function addTestResult(entry) {
  return saveTestResults([entry, ...getTestResults()])
}

export function deleteTestResult(id) {
  return saveTestResults(getTestResults().filter(item => item.id !== id))
}

export function clearTestResults() {
  localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify([]))
  return []
}
