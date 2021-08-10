import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  Button,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import * as SQLite from "expo-sqlite";
import * as ImagePicker from "expo-image-picker";
import * as Permissions from "expo-permissions";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const MainScreen = () => {
  const [dataFromDatabase, setDataFromDatabase] = useState();
  const [recordOn, setRecordOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [pictureURI, setpicURI] = useState();
  const [audioURI, setAudioURI] = useState();
  const [caption, setCaption] = useState("");
  const [recording, setRecording] = useState();
  const [selectedImage, setSelectedImage] = useState(false);
  const [messageForFile, setMessageFile] = useState();
  const soundObject = null;
  /*------------------DATABASE AREA-----------------------*/
  const db = SQLite.openDatabase("finalexamDB");

  useEffect(
    () => {
      db.transaction((tx) => {
        tx.executeSql(
          "CREATE TABLE IF NOT EXISTS ImageTable (id INTEGER PRIMARY KEY NOT NULL, pictureURI BLOB, audioURI BLOB, caption TEXT);",
          [],
          () => console.log("TABLE CREATED!"),
          (_, result) => console.log("TABLE CREATE failed:" + result)
        );
      });

      // retrieve the current contents of the DB tables we want
      retrieveFromDatabase();
    },
    // add [] as extra argument to only have this fire on mount and unmount (or else it fires every render/change)
    []
  );

  const onCaptionChangeHandler = (value) => {
    setCaption(value);
  };

  const saveToDatabase = () => {
    // transaction(callback, error, success)
    db.transaction((tx) => {
      // executeSql(sqlStatement, arguments, success, error)
      tx.executeSql(
        "INSERT INTO ImageTable (pictureURI, audioURI, caption) values (?, ?, ?)",
        [pictureURI, audioURI, caption],
        (_, { rowsAffected }) =>
          rowsAffected > 0
            ? console.log("ROW INSERTED!")
            : console.log("INSERT FAILED!"),
        (_, result) => console.log("INSERT failed:" + result)
      );
    });
    retrieveFromDatabase();
  };

  const retrieveFromDatabase = () => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT * FROM ImageTable",
        [],
        (_, { rows }) => {
          console.log("ROWS RETRIEVED!");

          // clear data currently stored
          setDataFromDatabase("");

          let entries = rows._array;

          entries.forEach((entry) => {
            setDataFromDatabase(
              (prev) =>
                prev +
                `${entry.id}, ${entry.pictureURI}, ${entry.audioURI}, ${entry.caption}\n`
            );
          });
        },
        (_, result) => {
          console.log("SELECT failed!");
          console.log(result);
        }
      );
    });
  };
  /*-------------Permissions for all AREAS---------------------*/
  const verifyPermissions = async () => {
    const result = await Permissions.askAsync(
      Permissions.AUDIO_RECORDING,
      Permissions.CAMERA,
      Permissions.CAMERA_ROLL
    );
    if (result.status !== "granted") {
      Alert.alert(
        "Insufficient Permissions!",
        "You need to grant audio recording and camera permissions to use this app.",
        [{ text: "Okay" }]
      );
      return false;
    }
    return true;
  };
  /*-------------AUDIO AREA---------------------*/
  const recordAudio = async () => {
    const hasPermission = await verifyPermissions();
    if (!hasPermission) {
      return false;
    } else {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      const newRecording = new Audio.Recording();
      if (!recordOn) {
        try {
          await newRecording.prepareToRecordAsync(
            Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
          );
          await newRecording.startAsync();
          console.log("Recording Started");
          setRecording(newRecording);
          setRecordOn(true);
          const uri = newRecording.getURI();
          setAudioURI(uri);
          console.log(``);
        } catch (error) {
          console.log("An error occurred on starting record:");
          console.log(error);
        }
      } else {
        try {
          await recording.stopAndUnloadAsync();
          setRecordOn(false);
          console.log("Recording stopped!");
        } catch (error) {
          console.log("An error occurred on stopping record:");
          console.log(error);
        }
      }
    }
  };
  const PlayRecording = async () => {
    await Audio.setAudioModeAsync({
      // set to false to play through speaker (instead of headset)
      allowsRecordingIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });
    soundObject = new Audio.Sound();
    if (!audioOn) {
      try {
        await soundObject.loadAsync({ uri: recording.getURI() });
        await soundObject.setStatusAsync({ isLooping: false });
        await soundObject.playAsync();
        setAudioOn(true);
        console.log("playing the recording");
      } catch (error) {
        console.log("An error occurred on playback:");
        console.log(error);
      }
    } else {
      try {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
        setAudioOn(false);
        console.log("playback stopped!");
      } catch (error) {
        console.log("An error occurred while stopping playback:");
        console.log(error);
      }
    }
  };

  /*-------------------CAMERA AREA------------------------*/
  const retrieveImageHandler = async () => {
    const hasPermission = await verifyPermissions();
    if (!hasPermission) {
      return false;
    }
    const image = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!image.cancelled) {
      setpicURI(image.uri);
      setSelectedImage(true);
    }
  };

  /*----------File System Area--------*/
  const saveToFile = () => {
    const filePath = FileSystem.documentDirectory + "DBData.txt";
    setMessageFile(pictureURI, audioURI, caption);
    FileSystem.writeAsStringAsync(filePath, messageForFile, {})
      .then(() => {
        console.log("File was written!");
      })
      .catch((error) => {
        console.log("An error occurred: ");
        console.log(error);
      });
  };
  /*----------ALERT AREA---------*/
  const saveData = () => {
    saveToFile();
    saveToDatabase();
  };
  const okayDialog = {
    text: "Okay",
    onPress: () => console.log("closing/pressed"),
    style: "cancel",
  };
  const setUpDataInAlert = () => {
    retrieveFromDatabase();
    Alert.alert("SQlite Data", `${dataFromDatabase}`, [okayDialog], {
      cancelable: false,
    });
  };

  return (
    <View style={styles.form}>
      <View>
        <Text style={styles.header}>FINAL EXAM</Text>
        <Text style={styles.header}>s_friesen 0813682</Text>
      </View>
      <View
        style={{
          alignItems: "center",
          marginBottom: 15,
        }}
      >
        <TouchableOpacity onPress={retrieveImageHandler}>
          {!selectedImage ? (
            <Image
              style={{ width: 300, height: 300 }}
              source={require("./play.png")}
            />
          ) : (
            <Image
              style={{ width: 300, height: 300 }}
              source={{ isStatic: true, uri: `${pictureURI}` }}
            />
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.textInput}
        onChangeText={onCaptionChangeHandler}
        placeholder="Caption..."
      />
      <View
        style={{
          marginBottom: 30,
          justifyContent: "center",
          flexDirection: "row",
        }}
      >
        <View style={{ marginRight: 20 }}>
          <Button
            style={styles.button}
            title={!recordOn ? "Record Audio" : "Stop Record"}
            onPress={recordAudio}
          />
        </View>
        <View style={{ marginLeft: 20 }}>
          <Button
            style={styles.button}
            title={!audioOn ? "Play Audio" : "Stop Audio"}
            onPress={PlayRecording}
          />
        </View>
      </View>
      <View style={{ marginBottom: 50, width: "20%", marginLeft: 133 }}>
        <Button
          style={styles.button}
          color="#c64756"
          title="Save"
          onPress={saveData}
        />
      </View>

      <Button
        style={styles.button}
        color="#046582"
        title="Show DB Contents"
        onPress={setUpDataInAlert}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    margin: 30,
    marginTop: 60,
    justifyContent: "center",
  },
  header: {
    fontSize: 20,
    marginBottom: 15,
    textAlign: "center",
  },
  label: {
    fontSize: 15,
    marginBottom: 10,
    textAlign: "center",
  },
  textInput: {
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 15,
    paddingVertical: 4,
    paddingHorizontal: 2,
    textAlignVertical: "top",
  },
  button: {
    width: "50%",
    marginLeft: 15,
  },
});
export default MainScreen;
