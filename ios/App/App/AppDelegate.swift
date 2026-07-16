import UIKit
import Capacitor
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // DÜZELTME (2026-07-16): @capacitor-firebase/messaging ve
        // @capacitor-firebase/app eklentileri, Firebase'in native SDK'sını
        // KENDİLİĞİNDEN başlatmıyor — bu satır olmadan iOS'te "The default
        // Firebase app has not yet been configured" hatasıyla push kaydı
        // (ve GoogleService-Info.plist'in okunması) tamamen başarısız
        // oluyordu. Bu çağrı GoogleService-Info.plist'i okuyup Firebase'i
        // başlatan standart ve zorunlu adımdır; en geç return true'dan önce
        // çağrılmalı.
        FirebaseApp.configure()
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // DÜZELTME (2026-07-16) — KÖK SEBEP: Bu iki metod tamamen eksikti. iOS,
    // push token'ı (veya hatasını) uygulamaya bu delegate metodları üzerinden
    // bildirir. Bunlar olmadan @capacitor/push-notifications eklentisi
    // Apple'dan gelen yanıtı HİÇBİR ZAMAN alamıyordu — register() çağrısı
    // "döndü" ama ne 'registration' ne 'registrationError' JS event'i asla
    // tetiklenmiyordu, çünkü native taraf bunu Capacitor köprüsüne hiç
    // iletmiyordu. Entitlement, provisioning profile ve APNs key hepsi zaten
    // doğruydu — eksik olan sadece bu standart Capacitor bağlantı koduydu.
    // NOT: Artık @capacitor-firebase/messaging kullanılıyor olsa da bu iki
    // metod zararsız ve genel amaçlı standart Capacitor köprü kodu olduğu
    // için olduğu gibi bırakıldı.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}
