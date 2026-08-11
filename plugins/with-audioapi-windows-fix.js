const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Windows fix for react-native-audio-api's `downloadPrebuiltBinaries` task.
 *
 * The task runs `C:\Program Files\Git\usr\bin\bash.exe <script>`, but when
 * bash is invoked directly (not via a login shell) Git's /usr/bin and
 * /mingw64/bin are NOT on PATH — `mkdir`, `rm`, `curl`, `unzip` are missing
 * and `find` resolves to Windows' incompatible FIND.EXE, so the script dies
 * with exit 127. Prepending Git's tool directories to the task's PATH fixes it.
 */
const MARKER = '// audioapi-windows-path-fix';

const GRADLE_FIX = `
${MARKER}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
    def gitToolDirs = ['C:\\\\Program Files\\\\Git\\\\usr\\\\bin', 'C:\\\\Program Files\\\\Git\\\\mingw64\\\\bin']
    if (gitToolDirs.every { new File(it).exists() }) {
        subprojects { proj ->
            proj.tasks.matching { it.name == 'downloadPrebuiltBinaries' }.configureEach { t ->
                t.doFirst {
                    // Mutate the inherited key ('Path' on Windows) instead of adding a
                    // duplicate 'PATH' entry — Windows env keys are case-insensitive.
                    def envMap = t.environment
                    def pathKey = envMap.keySet().find { it.equalsIgnoreCase('PATH') } ?: 'PATH'
                    envMap[pathKey] = gitToolDirs.join(File.pathSeparator) + File.pathSeparator + (envMap[pathKey] ?: '')
                }
            }
        }
    }
}
`;

module.exports = function withAudioApiWindowsFix(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += GRADLE_FIX;
    }
    return mod;
  });
};
