import UIKit
import Capacitor
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // DUZELTME (2026-07-17): Build 32, Apple incelemesinde ACILISTA COKTU
        // (SIGABRT, didFinishLaunchingWithOptions icinde NSException).
        // Sebep: FirebaseApp.configure() cagrisi GoogleService-Info.plist
        // dosyasini uygulama bundle'inda ariyor; dosya repoda dogru klasorde
        // olsa da Xcode projesinin Copy Bundle Resources listesine kayitli
        // olmadigi icin IPA'ya hic girmiyordu ve configure() exception
        // firlatiyordu. COZUM: Firebase yapilandirmasi artik plist'e muhtac
        // olmadan asagidaki degerlerle PROGRAMATIK olarak veriliyor.
        // Degerler GoogleService-Info.plist icerigiyle birebir aynidir.
        // (Bu degerler istemci tarafi yapilandirmadir, IPA icinde zaten
        // herkese aciktir; koda gomulmesi ek guvenlik riski yaratmaz.)
        let firebaseOptions = FirebaseOptions(
            googleAppID: "1:98018570739:ios:342dc6fd45007b38d3a286",
            gcmSenderID: "98018570739"
        )
        firebaseOptions.apiKey = "AIzaSyAME1opfHyW_xM1RTW_QA4CUOYvGBjiBKI"
        firebaseOptions.projectID = "katilim-plus"
        firebaseOptions.storageBucket = "katilim-plus.firebasestorage.app"
        firebaseOptions.bundleID = "com.katilimplus.app"
        FirebaseApp.configure(options: firebaseOptions)
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // Push token koprusu (2026-07-16 duzeltmesinden, oldugu gibi korundu):
    // iOS push token'i (veya hatasini) bu delegate metodlariyla bildirir;
    // bunlar Capacitor koprusune iletir.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}
