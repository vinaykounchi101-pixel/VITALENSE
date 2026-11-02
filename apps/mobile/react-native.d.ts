declare module "react-native" {
  export const Platform: {
    OS: "ios" | "android" | "windows" | "macos" | "web";
    select: <T>(obj: { [key: string]: T }) => T;
  };
  export const View: any;
  export const Text: any;
  export const ScrollView: any;
  export const TouchableOpacity: any;
  export const TextInput: any;
  export const StyleSheet: {
    create: <T extends Record<string, any>>(styles: T) => T;
  };
  export const RefreshControl: any;
  export const SafeAreaView: any;
  export const ActivityIndicator: any;
  export const Alert: {
    alert: (title: string, message?: string, buttons?: any[]) => void;
  };
}

declare module "expo-status-bar" {
  export const StatusBar: (props: { style?: "auto" | "inverted" | "light" | "dark" }) => any;
}
