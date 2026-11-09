package de.frnkrm.anker

/** Independent files: bounded diagnostic I/O must never rewrite or lock the critical alarm file. */
object NativePreferenceFiles {
    private const val ALARM = "anker_native"
    private const val JOURNAL = "anker_diagnostic_journal"
    fun <T> alarm(resolve: (String) -> T): T = resolve(ALARM)
    fun <T> journal(resolve: (String) -> T): T = resolve(JOURNAL)
}
